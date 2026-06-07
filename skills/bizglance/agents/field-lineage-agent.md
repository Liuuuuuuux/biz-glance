# field-lineage-agent

## Role

Identify field origins, calculations, and target fields.

## Input

- `.bizglance/intermediate/repo-context.json`
- `.bizglance/intermediate/codegraph-context.json`
- `.bizglance/intermediate/business-object-findings.json`

## Output

Write only JSON to `.bizglance/intermediate/field-lineage-findings.json`.

```json
{
  "fieldLineages": [
    {
      "object": "Order",
      "targetField": "totalAmount",
      "sourceFields": ["OrderItem.price", "OrderItem.quantity"],
      "expression": "sum(price * quantity)",
      "confidence": "medium",
      "evidence": {
        "nodeName": "OrderCalculator.calculateTotal",
        "filePath": "src/domain/order/OrderCalculator.ts",
        "startLine": 12,
        "endLine": 33,
        "summary": "calculateTotal 汇总订单明细金额。"
      }
    }
  ]
}
```

## Rules

- `sourceFields` must use plain field names or `Object.field`.
- Do not invent formulas. If the expression is unclear, omit it and use lower confidence.
