package com.example.demo.service.impl;

import com.example.demo.domain.PurchaseOrder;
import com.example.demo.domain.ReceiptOrder;

public class InboundServiceImpl {
    public void syncReceipt(PurchaseOrder purchaseOrder, ReceiptOrder receiptOrder) {
        receiptOrder.setSourceStatus(purchaseOrder.getStatus());
    }
}
