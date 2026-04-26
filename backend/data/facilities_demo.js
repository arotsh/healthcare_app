// Bundled offline dataset for demo / development when the Databricks SQL
// warehouse is unavailable. ~50 facilities covering 24 Indian states/UTs
// with rich profile text for the IDP demo, varied capability profiles for
// the chat ranking, and uneven state distribution to make the desert
// heatmap meaningful.
//
// Schema mirrors workspace.default.facility_signals so the rest of the
// pipeline doesn't have to know whether the data came from Databricks or
// from this file.

function f(props) {
  // Auto-derive signals from numeric scores
  const sig = (s) => (s >= 3 ? 'strong' : s === 2 ? 'medium' : s === 1 ? 'weak' : 'none');
  return {
    facility_id: props.id,
    name: props.name,
    address_city: props.city,
    address_stateOrRegion: props.state,
    address_zipOrPostcode: props.zip ?? null,
    latitude: props.lat,
    longitude: props.lng,
    facility_type: props.type ?? 'Hospital',
    facility_profile_text: props.profile,
    emergency_score: props.scores[0],
    surgery_score: props.scores[1],
    critical_care_score: props.scores[2],
    diagnostic_score: props.scores[3],
    maternal_neonatal_score: props.scores[4],
    specialty_score: props.scores[5],
    emergency_signal: sig(props.scores[0]),
    surgery_signal: sig(props.scores[1]),
    critical_care_signal: sig(props.scores[2]),
    diagnostic_signal: sig(props.scores[3]),
    maternal_neonatal_signal: sig(props.scores[4]),
    specialty_signal: sig(props.scores[5]),
    trust_score: props.trust,
    capability_score: props.capability,
    overall_facility_score: Number(((props.trust + props.capability) / 2).toFixed(2)),
    risk_flags: props.risks ?? [],
  };
}

export const FACILITIES = [
  // ── Delhi (4) ─────────────────────────────────────────────────────────
  f({ id: 1001, name: 'AIIMS New Delhi', city: 'New Delhi', state: 'Delhi', zip: '110029', lat: 28.5672, lng: 77.2094, type: 'Hospital',
    scores: [3,3,3,3,2,3], trust: 0.92, capability: 0.95,
    profile: 'All India Institute of Medical Sciences is a 2,478-bed apex multi-specialty teaching hospital in New Delhi. The 24/7 trauma and emergency department handles 800+ daily walk-ins. Five dedicated trauma operating theatres are staffed round the clock. Critical-care services include 200+ ICU beds across cardiac, neuro, pediatric, and general units. MRI, CT, and PET-CT imaging are available 24/7. The hospital trains 5,000+ doctors annually and runs national centres of excellence in cardiology, oncology, neurology, and nephrology. Power backup is provided by diesel generators with auto-switchover.' }),
  f({ id: 1002, name: 'Sir Ganga Ram Hospital', city: 'New Delhi', state: 'Delhi', zip: '110060', lat: 28.6402, lng: 77.1899,
    scores: [3,3,3,3,3,3], trust: 0.88, capability: 0.91,
    profile: 'Sir Ganga Ram Hospital is a 675-bed multi-specialty institution with a 24-hour casualty unit, 14 modular operation theatres, and a 90-bed critical-care complex. The hospital operates a robotic surgery programme, has full diagnostic imaging including 3T MRI, and runs centres of excellence in cardiac sciences, kidney transplant, IVF, and pediatric surgery. The maternal-neonatal block has Level-3 NICU. Power, water, and ambulance backup operate continuously.' }),
  f({ id: 1003, name: 'Max Smart Super Speciality Hospital', city: 'New Delhi', state: 'Delhi', zip: '110017', lat: 28.5421, lng: 77.2167,
    scores: [3,3,3,3,2,3], trust: 0.86, capability: 0.89,
    profile: 'Max Smart is a 250-bed super-specialty hospital in Saket, New Delhi. Round-the-clock emergency, eight modular OTs, 60 ICU beds, and full diagnostic imaging including a 64-slice CT and 1.5T MRI. Specialty centres include cardiac sciences, oncology, neurosciences, and orthopaedics with MAKO robotic knee replacement. Maternal services available but limited to a 12-bed maternity wing.' }),
  f({ id: 1004, name: 'Dr. Lal PathLabs Diagnostic Centre', city: 'New Delhi', state: 'Delhi', zip: '110028', lat: 28.6133, lng: 77.2089, type: 'Diagnostic Center',
    scores: [0,0,0,3,0,1], trust: 0.84, capability: 0.62,
    profile: 'A leading NABL-accredited diagnostic centre offering 4,000+ tests including pathology, radiology, MRI, CT, ultrasound, and genomics. No inpatient facilities, no emergency services. Sample collection from 350+ home-collection points across Delhi NCR.' }),

  // ── Maharashtra (6) ──────────────────────────────────────────────────
  f({ id: 1101, name: 'Tata Memorial Hospital', city: 'Mumbai', state: 'Maharashtra', zip: '400012', lat: 19.0034, lng: 72.8423,
    scores: [2,3,3,3,1,3], trust: 0.94, capability: 0.96,
    profile: 'Tata Memorial Hospital is a 700-bed comprehensive cancer centre with 28 surgical specialties, 9 dedicated oncology operating theatres, and a 90-bed critical-care unit. Nuclear medicine, PET-CT, linear accelerators, and proton therapy are operational. The hospital sees 70,000+ new cancer patients annually. Limited general emergency — referrals only. No maternity services.' }),
  f({ id: 1102, name: 'Kokilaben Dhirubhai Ambani Hospital', city: 'Mumbai', state: 'Maharashtra', zip: '400053', lat: 19.1335, lng: 72.8253,
    scores: [3,3,3,3,3,3], trust: 0.89, capability: 0.92,
    profile: 'Kokilaben is a 750-bed quaternary-care hospital with 22 modular OTs, 154 ICU beds, full 24/7 emergency department, and Indias largest robotic-surgery programme including da Vinci Xi. Centres of excellence include heart institute, neurosciences, oncology, transplant, and a 36-bed Level-3 NICU. 3T MRI and 256-slice CT operate 24x7. Power backup, central O2, and ambulance fleet of 15.' }),
  f({ id: 1103, name: 'Bombay Hospital', city: 'Mumbai', state: 'Maharashtra', zip: '400020', lat: 18.9412, lng: 72.8226,
    scores: [3,3,2,2,2,3], trust: 0.82, capability: 0.80,
    profile: 'Bombay Hospital is a 750-bed multi-specialty institution. Round-the-clock emergency, 12 OTs handling general surgery, ortho, and cardiac procedures. ICU available but bed availability is variable. CT and MRI imaging on weekday day shifts only. Power backup operates but reportedly fails during long outages.',
    risks: ['mri_limited_hours', 'icu_bed_availability_variable'] }),
  f({ id: 1104, name: 'Ruby Hall Clinic', city: 'Pune', state: 'Maharashtra', zip: '411001', lat: 18.5314, lng: 73.8782,
    scores: [3,3,3,3,3,3], trust: 0.86, capability: 0.88,
    profile: 'Ruby Hall is a 750-bed multi-specialty hospital with 24/7 emergency, 18 OTs, 150 ICU beds, and a comprehensive maternal-fetal unit with Level-3 NICU. Cardiac, neuro, oncology, transplant programmes. Imaging includes 3T MRI, 64-slice CT, mammography, and PET-CT.' }),
  f({ id: 1105, name: 'Jehangir Hospital', city: 'Pune', state: 'Maharashtra', zip: '411001', lat: 18.5288, lng: 73.8769,
    scores: [2,2,2,3,2,2], trust: 0.78, capability: 0.74,
    profile: 'Jehangir Hospital is a 350-bed multi-specialty institution with 24/7 emergency, six OTs, 30 ICU beds, full diagnostic imaging, and a 12-bed maternity unit. Cardiology and orthopaedics are key specialties.' }),
  f({ id: 1106, name: 'Nashik Civil Hospital', city: 'Nashik', state: 'Maharashtra', zip: '422001', lat: 19.9975, lng: 73.7898,
    scores: [2,1,1,1,2,1], trust: 0.55, capability: 0.42,
    profile: 'Nashik Civil Hospital is a 600-bed government district hospital. Casualty is open 24x7 but trauma surgery referred to Pune. Two OTs operate during day shift. ICU has 8 beds, oxygen sometimes rationed. CT scan reportedly out of service for 3 months as of 2024.',
    risks: ['ct_out_of_service', 'oxygen_rationing_reports', 'staff_shortage'] }),

  // ── Karnataka (4) ─────────────────────────────────────────────────────
  f({ id: 1201, name: 'Manipal Hospital Whitefield', city: 'Bangalore', state: 'Karnataka', zip: '560066', lat: 12.9716, lng: 77.7506,
    scores: [3,3,3,3,3,3], trust: 0.88, capability: 0.91,
    profile: 'Manipal Hospital Whitefield is a 280-bed quaternary-care hospital with 24/7 emergency, 8 modular OTs, 50 ICU beds, full diagnostic imaging including 3T MRI, and a Level-3 NICU. Robotic surgery and cardiac transplant programme. Maternity unit handles 200+ deliveries monthly.' }),
  f({ id: 1202, name: 'Narayana Health City', city: 'Bangalore', state: 'Karnataka', zip: '560099', lat: 12.8081, lng: 77.6569,
    scores: [3,3,3,3,3,3], trust: 0.91, capability: 0.93,
    profile: 'Narayana Health City is a 2,000-bed multi-specialty cluster including Indias largest cardiac surgery centre, performing 30+ open-heart procedures daily. 24/7 emergency, 24 OTs, 250 ICU beds, full imaging, and Level-3 NICU. Specialties include cardiac, neuro, ortho, oncology, and transplant.' }),
  f({ id: 1203, name: 'Apollo Specialty Hospital', city: 'Mysuru', state: 'Karnataka', zip: '570017', lat: 12.3052, lng: 76.6553,
    scores: [3,2,2,2,2,2], trust: 0.81, capability: 0.76,
    profile: 'Apollo Mysuru is a 200-bed multi-specialty hospital with 24-hour emergency, six OTs, 22 ICU beds, full imaging including CT and 1.5T MRI. Cardiac cath lab and orthopaedic services. Maternity unit with Level-2 NICU.' }),
  f({ id: 1204, name: 'Hubli District Hospital', city: 'Hubli', state: 'Karnataka', zip: '580020', lat: 15.3647, lng: 75.1240,
    scores: [2,1,1,1,2,1], trust: 0.58, capability: 0.45,
    profile: 'A 350-bed government district hospital. Casualty 24x7. Two OTs functional. Eight-bed ICU sometimes shares ventilators. X-ray and basic ultrasound; CT scan referred out. Power backup unreliable per local reports.',
    risks: ['power_backup_unreliable', 'ventilator_shortage'] }),

  // ── Tamil Nadu (4) ───────────────────────────────────────────────────
  f({ id: 1301, name: 'Apollo Hospitals Greams Road', city: 'Chennai', state: 'Tamil Nadu', zip: '600006', lat: 13.0631, lng: 80.2497,
    scores: [3,3,3,3,3,3], trust: 0.89, capability: 0.93,
    profile: 'Apollo Greams is a 1,000-bed flagship quaternary hospital with 24/7 emergency, 30 OTs, 200+ ICU beds, robotic surgery, and a 60-bed Level-3 NICU. Heart, transplant, oncology, neurosciences, and orthopaedics are major specialties. 3T MRI, 256-slice CT, PET-CT, and proton therapy facility.' }),
  f({ id: 1302, name: 'Christian Medical College Vellore', city: 'Vellore', state: 'Tamil Nadu', zip: '632004', lat: 12.9244, lng: 79.1352,
    scores: [3,3,3,3,3,3], trust: 0.95, capability: 0.94,
    profile: 'CMC Vellore is a 2,800-bed teaching hospital known for affordable quality. 24/7 emergency, 50+ OTs, 300 ICU beds, full imaging, and one of Indias largest organ transplant programmes. Maternal-fetal medicine, Level-3 NICU, comprehensive cancer centre, and global leader in HIV care.' }),
  f({ id: 1303, name: 'Madurai Government Hospital', city: 'Madurai', state: 'Tamil Nadu', zip: '625020', lat: 9.9252, lng: 78.1198,
    scores: [3,2,2,2,3,2], trust: 0.69, capability: 0.61,
    profile: 'Madurai Government Hospital is a 1,000-bed teaching hospital. Casualty 24x7, 12 OTs, 40 ICU beds. CT and ultrasound 24x7; MRI on weekday day shifts. Maternity unit handles 400+ deliveries monthly with Level-2 NICU.' }),
  f({ id: 1304, name: 'Coimbatore Eye Care Centre', city: 'Coimbatore', state: 'Tamil Nadu', zip: '641001', lat: 11.0168, lng: 76.9558, type: 'Specialty Clinic',
    scores: [0,2,0,2,0,3], trust: 0.78, capability: 0.65,
    profile: 'A specialty ophthalmology centre with three OTs, 30 day-care beds, and complete diagnostic imaging for the eye. Cataract, retinal, glaucoma, and refractive surgery. No emergency, no general medicine.' }),

  // ── West Bengal (3) ──────────────────────────────────────────────────
  f({ id: 1401, name: 'AMRI Hospital Salt Lake', city: 'Kolkata', state: 'West Bengal', zip: '700091', lat: 22.5826, lng: 88.4174,
    scores: [3,3,3,3,2,3], trust: 0.84, capability: 0.86,
    profile: 'AMRI Salt Lake is a 250-bed multi-specialty hospital with 24/7 emergency, 8 OTs, 35 ICU beds, full imaging including 3T MRI. Cardiac, neuro, oncology services. Maternity wing with Level-2 NICU.' }),
  f({ id: 1402, name: 'Apollo Gleneagles', city: 'Kolkata', state: 'West Bengal', zip: '700054', lat: 22.5848, lng: 88.4131,
    scores: [3,3,3,3,3,3], trust: 0.86, capability: 0.89,
    profile: 'Apollo Gleneagles is a 700-bed quaternary care hospital with 24/7 emergency, 16 OTs, 110 ICU beds. Robotic surgery, cardiac transplant, comprehensive oncology, neurosciences, and transplant programmes. 3T MRI, 64-slice CT, PET-CT.' }),
  f({ id: 1403, name: 'Siliguri District Hospital', city: 'Siliguri', state: 'West Bengal', zip: '734001', lat: 26.7271, lng: 88.3953,
    scores: [2,1,1,2,2,1], trust: 0.56, capability: 0.43,
    profile: 'A 450-bed government district hospital. Casualty open 24x7. Three OTs functional during day. ICU has 12 beds. CT scan available; MRI referred out. Power outages reported during monsoon.',
    risks: ['power_outages_monsoon', 'limited_specialty_referrals'] }),

  // ── Telangana (2) ────────────────────────────────────────────────────
  f({ id: 1501, name: 'Apollo Hospitals Jubilee Hills', city: 'Hyderabad', state: 'Telangana', zip: '500033', lat: 17.4126, lng: 78.4071,
    scores: [3,3,3,3,3,3], trust: 0.88, capability: 0.91,
    profile: 'Apollo Jubilee is a 550-bed flagship multi-specialty hospital with 24/7 emergency, 14 OTs, 100 ICU beds, and 3T MRI/PET-CT. Cardiac, transplant, oncology, neurology centres of excellence. Level-3 NICU and high-risk maternity unit.' }),
  f({ id: 1502, name: 'Yashoda Hospital Secunderabad', city: 'Hyderabad', state: 'Telangana', zip: '500003', lat: 17.4399, lng: 78.4983,
    scores: [3,3,3,3,2,3], trust: 0.83, capability: 0.85,
    profile: 'Yashoda is a 500-bed multi-specialty hospital with 24/7 emergency, 12 OTs, 90 ICU beds. Cardiac sciences, oncology, neurosciences, ortho. 3T MRI, 64-slice CT, full lab.' }),

  // ── Gujarat (3) ──────────────────────────────────────────────────────
  f({ id: 1601, name: 'Sterling Hospital', city: 'Ahmedabad', state: 'Gujarat', zip: '380054', lat: 23.0395, lng: 72.5305,
    scores: [3,3,3,3,2,3], trust: 0.83, capability: 0.85,
    profile: 'Sterling Hospital Ahmedabad is a 320-bed multi-specialty hospital with 24/7 emergency, 8 OTs, 50 ICU beds, MRI and CT 24x7. Cardiac, oncology, neuro, ortho specialties. Maternity unit with Level-2 NICU.' }),
  f({ id: 1602, name: 'Surat Civil Hospital', city: 'Surat', state: 'Gujarat', zip: '395001', lat: 21.1959, lng: 72.8302,
    scores: [3,2,2,2,3,2], trust: 0.65, capability: 0.58,
    profile: 'Surat Civil Hospital is a 1,500-bed government tertiary hospital. Casualty open 24x7 with trauma capability, 14 OTs, 60 ICU beds. CT, MRI, and ultrasound 24x7. High-volume maternity with Level-3 NICU.' }),
  f({ id: 1603, name: 'Bhavnagar Sub-Divisional Hospital', city: 'Bhavnagar', state: 'Gujarat', zip: '364001', lat: 21.7645, lng: 72.1519,
    scores: [2,1,1,1,2,1], trust: 0.55, capability: 0.41,
    profile: 'A 200-bed government hospital. Casualty open 24x7. Two OTs. Six-bed ICU, oxygen supply variable. Basic X-ray and ultrasound only. CT and MRI referred to Ahmedabad.',
    risks: ['oxygen_supply_variable', 'ct_referred_out', 'mri_referred_out'] }),

  // ── Uttar Pradesh (3) ────────────────────────────────────────────────
  f({ id: 1701, name: 'SGPGIMS Lucknow', city: 'Lucknow', state: 'Uttar Pradesh', zip: '226014', lat: 26.7411, lng: 80.9466,
    scores: [3,3,3,3,2,3], trust: 0.88, capability: 0.90,
    profile: 'Sanjay Gandhi PGI is a 1,250-bed apex tertiary care institute. 24/7 emergency, 24 OTs, 180 ICU beds. Renal transplant, hepatology, neurosciences, cardiology. 3T MRI, PET-CT.' }),
  f({ id: 1702, name: 'Banaras Hindu University Hospital', city: 'Varanasi', state: 'Uttar Pradesh', zip: '221005', lat: 25.2677, lng: 82.9913,
    scores: [2,2,2,2,3,2], trust: 0.72, capability: 0.66,
    profile: 'BHU Hospital is a 1,100-bed teaching institution. Casualty 24x7. 14 OTs. ICU 50 beds. CT and ultrasound 24x7; MRI on weekday shifts. Large maternity service with Level-2 NICU.' }),
  f({ id: 1703, name: 'Gorakhpur District Hospital', city: 'Gorakhpur', state: 'Uttar Pradesh', zip: '273001', lat: 26.7606, lng: 83.3732,
    scores: [2,1,1,1,2,1], trust: 0.50, capability: 0.38,
    profile: 'A 600-bed government hospital. Casualty 24x7 but understaffed at night. ICU 10 beds, ventilator availability inconsistent. CT scan installed but reportedly idle.',
    risks: ['ct_idle', 'night_staff_shortage', 'ventilator_inconsistent'] }),

  // ── Bihar (2) — desert state, low coverage ───────────────────────────
  f({ id: 1801, name: 'Indira Gandhi Institute of Medical Sciences', city: 'Patna', state: 'Bihar', zip: '800014', lat: 25.5808, lng: 85.0935,
    scores: [3,2,2,2,2,2], trust: 0.74, capability: 0.68,
    profile: 'IGIMS Patna is a 700-bed apex tertiary hospital for Bihar. Casualty 24x7. 12 OTs. ICU 40 beds with central oxygen. CT and MRI 24x7. Maternal-fetal unit with Level-2 NICU. Kidney transplant programme operational.' }),
  f({ id: 1802, name: 'Sadar Hospital Muzaffarpur', city: 'Muzaffarpur', state: 'Bihar', zip: '842001', lat: 26.1209, lng: 85.3647,
    scores: [2,1,1,1,2,1], trust: 0.48, capability: 0.36,
    profile: 'Sadar Hospital is a 250-bed government hospital. Casualty 24x7. Two OTs. Six-bed ICU. X-ray only. CT, MRI, and ultrasound referred to Patna. Power outages frequent in summer.',
    risks: ['no_ct', 'no_mri', 'frequent_power_outages'] }),

  // ── Kerala (2) ────────────────────────────────────────────────────────
  f({ id: 1901, name: 'Sree Chitra Tirunal Institute', city: 'Thiruvananthapuram', state: 'Kerala', zip: '695011', lat: 8.5396, lng: 76.9134,
    scores: [3,3,3,3,2,3], trust: 0.91, capability: 0.92,
    profile: 'SCTIMST is a 250-bed cardiac and neurosciences super-specialty institute. 24/7 emergency for cardiac cases, 8 cardiac OTs, 50 ICU beds. Comprehensive cardiac surgery including transplant. Stroke unit and neurosurgery.' }),
  f({ id: 1902, name: 'Aster Medcity Kochi', city: 'Kochi', state: 'Kerala', zip: '682027', lat: 9.9982, lng: 76.2906,
    scores: [3,3,3,3,3,3], trust: 0.86, capability: 0.89,
    profile: 'Aster Medcity is a 670-bed quaternary hospital. 24/7 emergency, 14 OTs including robotic surgery, 130 ICU beds. Heart, neuro, ortho, transplant, oncology centres of excellence.' }),

  // ── Punjab (2) ───────────────────────────────────────────────────────
  f({ id: 2001, name: 'PGIMER Chandigarh', city: 'Chandigarh', state: 'Punjab', zip: '160012', lat: 30.7656, lng: 76.7754,
    scores: [3,3,3,3,3,3], trust: 0.92, capability: 0.94,
    profile: 'PGIMER is a 2,000-bed apex multi-specialty teaching hospital. 24/7 emergency, 40 OTs, 250 ICU beds. Comprehensive transplant, cardiac, neurosciences, oncology, and trauma services.' }),
  f({ id: 2002, name: 'Fortis Hospital Mohali', city: 'Mohali', state: 'Punjab', zip: '160062', lat: 30.7046, lng: 76.7179,
    scores: [3,3,3,3,2,3], trust: 0.83, capability: 0.85,
    profile: 'Fortis Mohali is a 355-bed multi-specialty hospital with 24/7 emergency, 10 OTs, 80 ICU beds. Cardiac, neuro, ortho specialties. 3T MRI and 64-slice CT.' }),

  // ── Rajasthan (2) ────────────────────────────────────────────────────
  f({ id: 2101, name: 'Sawai Man Singh Hospital', city: 'Jaipur', state: 'Rajasthan', zip: '302004', lat: 26.9094, lng: 75.8053,
    scores: [3,2,2,2,3,2], trust: 0.70, capability: 0.62,
    profile: 'SMS Hospital is a 2,200-bed government tertiary hospital. Casualty 24x7. 16 OTs. 60 ICU beds. CT and MRI 24x7. High-volume maternity with Level-2 NICU.' }),
  f({ id: 2102, name: 'Eternal Hospital', city: 'Jaipur', state: 'Rajasthan', zip: '302017', lat: 26.8491, lng: 75.8088,
    scores: [3,3,3,3,2,3], trust: 0.81, capability: 0.83,
    profile: 'Eternal is a 250-bed multi-specialty hospital. 24/7 emergency, 8 OTs, 40 ICU beds. Cardiac sciences flagship. 1.5T MRI, 128-slice CT.' }),

  // ── Madhya Pradesh (2) ───────────────────────────────────────────────
  f({ id: 2201, name: 'Bansal Hospital Bhopal', city: 'Bhopal', state: 'Madhya Pradesh', zip: '462016', lat: 23.2156, lng: 77.4356,
    scores: [3,2,2,3,2,2], trust: 0.78, capability: 0.74,
    profile: 'Bansal is a 300-bed multi-specialty hospital. 24/7 emergency, 6 OTs, 28 ICU beds. CT and MRI 24x7. Cardiac, ortho, gastro specialties.' }),
  f({ id: 2202, name: 'Indore Civil Hospital', city: 'Indore', state: 'Madhya Pradesh', zip: '452001', lat: 22.7196, lng: 75.8577,
    scores: [2,1,1,1,2,1], trust: 0.54, capability: 0.42,
    profile: 'A 700-bed government district hospital. Casualty 24x7. Four OTs. ICU 12 beds. CT scan available; MRI referred out.',
    risks: ['no_mri', 'limited_specialist_coverage'] }),

  // ── Odisha (1), Jharkhand (1) ────────────────────────────────────────
  f({ id: 2301, name: 'AIIMS Bhubaneswar', city: 'Bhubaneswar', state: 'Odisha', zip: '751019', lat: 20.1849, lng: 85.7048,
    scores: [3,3,3,3,2,3], trust: 0.86, capability: 0.88,
    profile: 'AIIMS Bhubaneswar is a 950-bed apex teaching hospital. 24/7 emergency, 18 OTs, 120 ICU beds. Comprehensive multi-specialty care with cardiac, neuro, oncology, and transplant programmes.' }),
  f({ id: 2401, name: 'Rajendra Institute of Medical Sciences', city: 'Ranchi', state: 'Jharkhand', zip: '834009', lat: 23.4153, lng: 85.4376,
    scores: [2,2,2,2,2,2], trust: 0.65, capability: 0.58,
    profile: 'RIMS Ranchi is a 1,500-bed government teaching hospital. Casualty 24x7. 10 OTs. ICU 40 beds. CT, MRI, and ultrasound 24x7. Major maternity unit with Level-2 NICU.' }),

  // ── Northeast / lowest-coverage states (8) — desert visualization ────
  f({ id: 2501, name: 'Regional Institute of Medical Sciences', city: 'Imphal', state: 'Manipur', zip: '795004', lat: 24.7560, lng: 93.9402,
    scores: [2,2,1,2,2,2], trust: 0.63, capability: 0.55,
    profile: 'RIMS Imphal is a 1,000-bed government teaching hospital, the apex referral centre for Manipur. Casualty 24x7. Eight OTs. ICU 24 beds. CT and ultrasound 24x7; MRI on day shift.' }),
  f({ id: 2502, name: 'Civil Hospital Aizawl', city: 'Aizawl', state: 'Mizoram', zip: '796001', lat: 23.7271, lng: 92.7176,
    scores: [2,1,1,1,2,1], trust: 0.55, capability: 0.43,
    profile: 'Aizawl Civil Hospital is a 300-bed government hospital. Casualty 24x7. Three OTs. ICU 8 beds. CT scan available; MRI referred to Guwahati. Maternity unit handles ~80 deliveries monthly.',
    risks: ['no_mri', 'specialist_referrals_to_guwahati'] }),
  f({ id: 2503, name: 'STNM Hospital', city: 'Gangtok', state: 'Sikkim', zip: '737101', lat: 27.3389, lng: 88.6065,
    scores: [2,1,1,2,2,1], trust: 0.62, capability: 0.50,
    profile: 'Sir Thutob Namgyal Memorial Hospital is a 300-bed referral hospital for Sikkim. Casualty 24x7. Three OTs. ICU 10 beds. CT 24x7; MRI on weekdays. 24-bed maternity with Level-2 NICU.' }),
  f({ id: 2504, name: 'Naga Hospital Authority', city: 'Kohima', state: 'Nagaland', zip: '797001', lat: 25.6740, lng: 94.1086,
    scores: [2,1,1,1,2,1], trust: 0.50, capability: 0.40,
    profile: 'A 300-bed government hospital. Casualty 24x7. Two OTs. ICU 8 beds. Basic X-ray and CT scan; MRI referred out of state. Frequent power supply issues during winter.',
    risks: ['no_mri', 'winter_power_issues'] }),
  f({ id: 2505, name: 'Tomo Riba Institute of Health & Medical Sciences', city: 'Itanagar', state: 'Arunachal Pradesh', zip: '791110', lat: 27.0844, lng: 93.6053,
    scores: [2,1,1,1,2,1], trust: 0.52, capability: 0.41,
    profile: 'TRIHMS is a 300-bed teaching hospital, the apex public hospital in Arunachal Pradesh. Casualty 24x7. Three OTs. ICU 12 beds. CT scan operational; MRI installation pending. Maternity unit functional.',
    risks: ['mri_pending'] }),
  f({ id: 2506, name: 'Civil Hospital Shillong', city: 'Shillong', state: 'Meghalaya', zip: '793001', lat: 25.5788, lng: 91.8933,
    scores: [2,1,1,2,2,1], trust: 0.60, capability: 0.48,
    profile: 'Shillong Civil Hospital is a 320-bed government facility. Casualty 24x7. Three OTs. ICU 10 beds. CT 24x7; MRI scheduled. Maternity service Level-1.' }),
  f({ id: 2507, name: 'Govind Ballabh Pant Hospital', city: 'Agartala', state: 'Tripura', zip: '799006', lat: 23.8315, lng: 91.2868,
    scores: [2,2,1,2,2,1], trust: 0.58, capability: 0.46,
    profile: 'GBP Hospital is a 600-bed government hospital. Casualty 24x7. Six OTs. ICU 16 beds. CT and ultrasound 24x7. Maternity Level-2 NICU.' }),
  f({ id: 2508, name: 'Andaman & Nicobar Islands GB Pant Hospital', city: 'Port Blair', state: 'Andaman and Nicobar Islands', zip: '744104', lat: 11.6234, lng: 92.7265,
    scores: [2,1,1,1,2,1], trust: 0.55, capability: 0.43,
    profile: 'GB Pant Port Blair is a 500-bed government hospital, the only major tertiary hospital in the islands. Casualty 24x7. Four OTs. ICU 14 beds. CT 24x7; MRI on weekdays. Major referrals to Chennai.',
    risks: ['mainland_referrals_required', 'cyclone_disruption_risk'] }),

  // ── Goa (1) ──────────────────────────────────────────────────────────
  f({ id: 2601, name: 'Goa Medical College', city: 'Bambolim', state: 'Goa', zip: '403202', lat: 15.4612, lng: 73.8431,
    scores: [3,2,2,2,2,2], trust: 0.74, capability: 0.66,
    profile: 'Goa Medical College is a 1,100-bed government teaching hospital. Casualty 24x7. 10 OTs. ICU 35 beds. CT and ultrasound 24x7; MRI on weekday day shifts. Maternity unit Level-2.' }),
];

// Pre-build a state→count cache for the desert heatmap
export const STATE_COUNTS = (() => {
  const m = new Map();
  for (const f of FACILITIES) {
    m.set(f.address_stateOrRegion, (m.get(f.address_stateOrRegion) || 0) + 1);
  }
  return m;
})();
