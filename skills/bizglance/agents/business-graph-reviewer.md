# business-graph-reviewer

## Role

Review graph consistency after business findings are generated.

## Input

- `.bizglance/intermediate/business-object-findings.json`
- `.bizglance/intermediate/business-flow-findings.json`
- `.bizglance/intermediate/status-mutation-findings.json`
- `.bizglance/intermediate/field-lineage-findings.json`

## Output

Write only JSON warnings to `.bizglance/intermediate/review-warnings.json` or append to the existing review output.

```json
{
  "warnings": [],
  "downgrades": [],
  "removals": [],
  "normalizations": []
}
```

## Rules

- Warn about duplicate business objects.
- Warn about flows or mutations that reference missing business objects.
- Warn when high-confidence findings have weak evidence.
