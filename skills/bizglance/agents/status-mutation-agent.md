# status-mutation-agent

## Role

Identify status fields and transitions for business objects.

## Input

- `.bizglance/intermediate/repo-context.json`
- `.bizglance/intermediate/codegraph-context.json`
- `.bizglance/intermediate/business-object-findings.json`

## Output

Write only JSON to `.bizglance/intermediate/status-mutation-findings.json`.

```json
{
  "statusMutations": [
    {
      "object": "Order",
      "field": "status",
      "trigger": "OrderService.pay",
      "fromStatus": "created",
      "toStatus": "paid",
      "confidence": "high",
      "evidence": {
        "nodeName": "OrderService.pay",
        "filePath": "src/service/OrderService.ts",
        "startLine": 60,
        "endLine": 78,
        "summary": "pay 方法将订单状态改为 paid。"
      }
    }
  ]
}
```

## Rules

- Do not infer status transitions from enum names alone.
- If only a status field is found but no transition trigger exists, omit the mutation.
