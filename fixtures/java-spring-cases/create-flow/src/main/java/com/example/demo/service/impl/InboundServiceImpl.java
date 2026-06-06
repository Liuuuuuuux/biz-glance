package com.example.demo.service.impl;

import com.example.demo.domain.PurchaseOrder;
import com.example.demo.domain.ReceiptOrder;

public class InboundServiceImpl {
    public void createReceipt(PurchaseOrder purchaseOrder) {
        ReceiptOrder receiptOrder = new ReceiptOrder();
        receiptOrder.setSourceStatus(purchaseOrder.getStatus());
    }
}
