# business-flow-agent

## Role

Identify business relationships between known business objects.

## Input

- `.bizglance/intermediate/repo-context.json`
- `.bizglance/intermediate/codegraph-context.json`
- `.bizglance/intermediate/business-object-findings.json`

## Output

Write only JSON to `.bizglance/intermediate/business-flow-findings.json`.

```json
{
  "flows": [
    {
      "from": "Order",
      "to": "Payment",
      "relation": "creates",
      "label": "订单提交后创建支付记录",
      "confidence": "high",
      "evidence": {
        "nodeName": "OrderService.submitOrder",
        "filePath": "src/service/OrderService.ts",
        "startLine": 20,
        "endLine": 58,
        "summary": "submitOrder 调用 paymentService.createPayment。"
      }
    }
  ]
}
```

## Rules

- `relation` must be `creates`, `updates`, or `references`.
- Do not turn technical dependencies into business flows without business evidence.
- Unsupported but plausible relationships must use `low` confidence.
