package com.example.demo.service.impl;

import com.example.demo.domain.SalesOrder;

public class SalesOrderServiceImpl {
    public void changeStatus(String to) {
        SalesOrder order = new SalesOrder();
        order.setStatus(to);
    }
}
