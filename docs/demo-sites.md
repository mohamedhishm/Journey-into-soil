# Demo sites

A **demo site** is a pre-chosen real location (3-5 total) whose NASA data is fetched ahead of time and stored as a pack in `data/packs/demo_sites/<id>.json`, with a tuned input preset. The live demo and the video then never depend on network calls, and every site shows a different story (salinity, new lands, pest history, Upper Egypt).

Starting suggestions are in `knowledge/demo_sites.yaml` (Kafr El-Sheikh, Gharbia, West Nubaria, Minya, Fayoum). Confirm each point on the map with the experts, replace freely, keep 3-5. Any field outside a demo site still works with the synthetic placeholder (low confidence) or with live fetch if added later.

Per site, record: why chosen, expected story, data availability, expert sign-off.
