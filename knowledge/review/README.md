# Expert Review Packet

## Purpose
This packet lists existing agronomic assumptions and configuration values
that require review by a qualified agricultural domain expert.

## Reviewer instructions

The project team has completed its initial review of all entries.

For any future expert validation or proposed correction:
1. Record the proposed value.
2. Provide an exact supporting citation.
3. Explain the correction if needed.
4. Change Review Status to Reviewed only after qualified
   expert validation.
5. Apply approved values to the source YAML and set
   reviewed: true only after genuine expert validation.

Do not approve undocumented values.

## How to interpret Citation
The Citation column may contain:
- An internal FIELD.PUA section/row reference. The original document was
  not available in the repository during packet preparation.
- A candidate technical reference such as FAO-56 or FAO-29. The exact
  crop-to-table mapping and value must still be verified.
- An explicit missing-reference notice where no traceable source exists.

A reference name alone does not prove that a current value is correct.
The reviewer must provide an exact citation (document, table/page/section,
and relevant value) before approving a change.

## Reviewer instructions
For every proposed correction:
1. Record the proposed value.
2. Provide an exact supporting citation.
3. Explain the correction if needed.
4. Change Review Status to Reviewed only after actual expert review.
5. Apply the approved value to the source YAML and set reviewed: true
   only when the corresponding value has genuinely been reviewed.

Do not approve undocumented values.

## Important limitations
- FIELD.PUA was referenced by the knowledge files but its original source
  document was not found in the project during this audit.
- The crops.yaml defaults identify themselves as seeded defaults,
  not expert-approved values.
- The default source ID `fao_default` is not registered in sources.yaml.
- Demo-site coordinates and presets are starting suggestions, not
  verified field measurements.
- Season windows are indicative and require local validation.
- Successful YAML parsing confirms syntax only, not agronomic accuracy.
