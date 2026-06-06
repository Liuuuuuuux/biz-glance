package com.example.demo.service.impl;

import com.example.demo.domain.PurchaseOrder;
import com.example.demo.domain.ReceiptOrder;
import com.example.demo.mapper.PurchaseOrderMapper;
import com.example.demo.service.PurchaseOrderService;
import org.springframework.stereotype.Service;

@Service
public class PurchaseOrderServiceImpl implements PurchaseOrderService {
    private final PurchaseOrderMapper purchaseOrderMapper;

    public PurchaseOrderServiceImpl(PurchaseOrderMapper purchaseOrderMapper) {
        this.purchaseOrderMapper = purchaseOrderMapper;
    }

    @Override
    public void changeStatus(String from, String to) {
        PurchaseOrder order = new PurchaseOrder();
        order.setStatus(to);
        ReceiptOrder receiptOrder = new ReceiptOrder();
        receiptOrder.setSourceStatus(order.getStatus());
        purchaseOrderMapper.updateStatus(order);
    }
}
