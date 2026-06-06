package com.example.demo.controller;

import com.example.demo.service.PurchaseOrderService;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/purchase/order")
public class PurchaseOrderController {
    private final PurchaseOrderService purchaseOrderService;

    public PurchaseOrderController(PurchaseOrderService purchaseOrderService) {
        this.purchaseOrderService = purchaseOrderService;
    }

    @PutMapping("/changeStatus")
    public void changeStatus() {
        purchaseOrderService.changeStatus("NEW", "APPROVED");
    }
}
