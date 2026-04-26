# Databricks notebook source
# MAGIC %md
# MAGIC # MediMap — DLT ingest pipeline
# MAGIC
# MAGIC Streams raw facility records (CSV / JSON drops in cloud storage) through bronze → silver → gold tables in Delta Live Tables. The gold table `clean_facilities` is what the agent and the Vector Search source table point at.
# MAGIC
# MAGIC **Create the pipeline:**
# MAGIC 1. Workflows → Delta Live Tables → Create pipeline
# MAGIC 2. Source: this notebook
# MAGIC 3. Target catalog/schema: `workspace.default`
# MAGIC 4. Storage path: `/Volumes/workspace/default/medimap/dlt`
# MAGIC 5. Mode: Triggered (or Continuous if you want live updates)
# MAGIC
# MAGIC **Source contract:** drop new files into `/Volumes/workspace/default/medimap/raw/` with the same schema as the existing `clean_facilities` table. The bronze layer auto-loads them; silver normalizes types; gold de-dupes on `facility_id`.

# COMMAND ----------

import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StringType,
    DoubleType,
    IntegerType,
    BooleanType,
)

RAW_PATH = "/Volumes/workspace/default/medimap/raw"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Bronze — raw landing
# MAGIC Auto-loads new files (CSV/JSON) without re-reading old ones. Schema is inferred and stored at `cloudFiles.schemaLocation`.

# COMMAND ----------

@dlt.table(
    name="facilities_bronze",
    comment="Raw facility records as landed in cloud storage. Append-only.",
    table_properties={"quality": "bronze", "pipelines.autoOptimize.managed": "true"},
)
def facilities_bronze():
    return (
        spark.readStream
            .format("cloudFiles")
            .option("cloudFiles.format", "json")
            .option("cloudFiles.inferColumnTypes", "true")
            .option("cloudFiles.schemaEvolutionMode", "addNewColumns")
            .load(RAW_PATH)
            .withColumn("_ingested_at", F.current_timestamp())
            .withColumn("_source_file", F.col("_metadata.file_path"))
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Silver — typed + validated
# MAGIC Casts known columns, normalizes string nulls (`"null"` literal → `NULL`), drops rows missing `facility_id`.

# COMMAND ----------

@dlt.table(
    name="facilities_silver",
    comment="Typed + validated facility records. Deduplicated downstream.",
    table_properties={"quality": "silver"},
)
@dlt.expect_or_drop("has_facility_id", "facility_id IS NOT NULL")
@dlt.expect("has_name", "name IS NOT NULL")
@dlt.expect("valid_lat", "latitude IS NULL OR (latitude BETWEEN -90 AND 90)")
@dlt.expect("valid_lon", "longitude IS NULL OR (longitude BETWEEN -180 AND 180)")
def facilities_silver():
    df = dlt.read_stream("facilities_bronze")
    norm = lambda c: F.when(F.lower(F.col(c).cast("string")).isin("null", ""), None).otherwise(F.col(c))
    return (
        df.withColumn("facility_id", F.col("facility_id").cast(IntegerType()))
          .withColumn("name", norm("name"))
          .withColumn("address_city", norm("address_city"))
          .withColumn("address_stateOrRegion", norm("address_stateOrRegion"))
          .withColumn("address_zipOrPostcode", norm("address_zipOrPostcode"))
          .withColumn("latitude", F.col("latitude").cast(DoubleType()))
          .withColumn("longitude", F.col("longitude").cast(DoubleType()))
          .withColumn("facility_type", norm("facility_type"))
          .withColumn("trust_score", F.col("trust_score").cast(DoubleType()))
          .withColumn("capability_score", F.col("capability_score").cast(DoubleType()))
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Gold — de-duplicated, agent-ready
# MAGIC One row per `facility_id`, latest record wins. This is the table the Node backend and the Vector Search source read from.

# COMMAND ----------

@dlt.table(
    name="clean_facilities",
    comment="Authoritative deduplicated facility table. One row per facility_id. Backs the agent + vector search source.",
    table_properties={"quality": "gold", "pipelines.autoOptimize.managed": "true"},
)
def clean_facilities():
    s = dlt.read("facilities_silver")
    w = (
        F.row_number()
         .over(
             __import__("pyspark.sql.window", fromlist=["Window"]).Window
                 .partitionBy("facility_id")
                 .orderBy(F.col("_ingested_at").desc_nulls_last())
         )
    )
    return (
        s.withColumn("_rn", w)
         .filter("_rn = 1")
         .drop("_rn", "_ingested_at", "_source_file")
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Optional — embedding-ready projection for Vector Search
# MAGIC The `clean_facilities_vs_index` Mosaic AI Vector Search index reads this slim table. Cast lat/long to DOUBLE here so the index doesn't re-fail with `decimal(34,14)`.

# COMMAND ----------

@dlt.table(
    name="facilities_for_search",
    comment="Slim projection feeding the Mosaic AI Vector Search index.",
    table_properties={"quality": "gold"},
)
def facilities_for_search():
    return (
        dlt.read("clean_facilities")
           .select(
               F.col("facility_id").cast(IntegerType()).alias("facility_id"),
               F.col("name"),
               F.col("address_city"),
               F.col("address_stateOrRegion"),
               F.col("latitude").cast(DoubleType()).alias("latitude"),
               F.col("longitude").cast(DoubleType()).alias("longitude"),
               # `embed_text` is the column the index embeds. Concatenate the
               # human-readable signals so semantic search can match by
               # capability description, not just structured columns.
               F.concat_ws(
                   ". ",
                   F.coalesce(F.col("name"), F.lit("")),
                   F.concat_ws(", ",
                       F.coalesce(F.col("address_city"), F.lit("")),
                       F.coalesce(F.col("address_stateOrRegion"), F.lit("")),
                   ),
                   F.coalesce(F.col("facility_type"), F.lit("")),
               ).alias("embed_text"),
           )
    )
