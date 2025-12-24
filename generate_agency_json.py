import os
import csv
import json
import re

folder_path = "RPA AGENCIES"
output_file = "frontend/src/data/ehr_agencies.json"

ehr_map = {}

files = os.listdir(folder_path)
for filename in files:
    if filename.endswith(".csv"):
        # Extract EHR name from filename
        # Pattern: RPA Mastersheet Nov 07 - <EHR>.csv
        match = re.search(r"RPA Mastersheet Nov 07 - (.+)\.csv", filename)
        if match:
            ehr_name = match.group(1).strip()
            
            agencies = []
            file_path = os.path.join(folder_path, filename)
            try:
                with open(file_path, 'r', encoding='utf-8-sig') as csvfile:
                    reader = csv.DictReader(csvfile)
                    for row in reader:
                        if "Credential Name" in row and row["Credential Name"].strip():
                            agencies.append(row["Credential Name"].strip())
            except Exception as e:
                print(f"Error reading {filename}: {e}")
            
            if agencies:
                ehr_map[ehr_name] = sorted(agencies)

# Ensure directory exists
os.makedirs(os.path.dirname(output_file), exist_ok=True)

with open(output_file, 'w') as f:
    json.dump(ehr_map, f, indent=2)

print(f"Generated {output_file}")
