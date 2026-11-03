#!/bin/bash
# Download the public inputs into tools/pipeline/raw. They are not stored in this repository (about 75 MB).
set -e
cd "$(dirname "$0")"; mkdir -p raw/npm; cd raw
G=https://raw.githubusercontent.com
curl -sSL -o ne_places.geojson $G/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson
curl -sSL -o ne_admin0.geojson $G/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
curl -sSL -o grid_echarts.json $G/apache/echarts-examples/gh-pages/public/data-gl/asset/data/population.json
curl -sSL -o wpp_popprojAge1dt.rda $G/PPgp/wpp2024/main/data/popprojAge1dt.rda
W=$G/open-numbers/ddf--open_numbers--world_development_indicators/master/datapoints
for i in sl_emp_totl_sp_zs sl_tlf_cact_zs sl_tlf_acti_zs sl_emp_vuln_zs se_ter_enrr se_sec_enrr se_prm_enrr se_pre_enrr sl_agr_empl_zs sl_srv_empl_zs sl_ind_empl_zs sp_urb_totl_in_zs; do
  curl -sSL -o wdi_$i.csv $W/ddf--datapoints--$i--by--geo--time.csv
done
cd npm && npm pack world-atlas@2.0.2 --silent && tar xzf world-atlas-2.0.2.tgz
