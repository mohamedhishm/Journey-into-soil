---
title: NDVI and vegetation indices
sources: [nasa_ndvi_eo, modis_vi_guide, viirs_vi_guide]
---
# NDVI and vegetation indices

The Normalized Difference Vegetation Index (NDVI) is computed from satellite reflectance in the near-infrared and red bands: NDVI = (NIR - red) / (NIR + red). Healthy vegetation reflects strongly in the near-infrared and absorbs red light for photosynthesis, so higher NDVI values generally indicate more green leaf area and more active vegetation.

NDVI ranges from about -1 to 1. Values near zero or below are typical of bare soil, water, snow or cloud; moderate values indicate sparse or senescing vegetation; high values indicate dense, healthy canopies. The index saturates in very dense canopies, where further increases in leaf area barely change the value.

NDVI is an indicator of vegetation greenness and canopy condition. It is not a direct measurement of soil health, soil fertility, crop identity or yield. A low value can mean bare soil, a recently harvested field, a young crop, drought stress, salinity stress, or simply a cloudy composite, and the index alone cannot tell them apart.

Satellite vegetation products carry quality information that must be used. The 16-day MODIS and VIIRS vegetation index composites include a pixel-reliability layer and a detailed quality bit field describing cloud, shadow, snow and aerosol conditions; unreliable pixels should be excluded rather than interpreted. The pixel size also matters: a 250 m or 500 m pixel covers many small fields, so a single value is an area average and not a measurement of one field.
