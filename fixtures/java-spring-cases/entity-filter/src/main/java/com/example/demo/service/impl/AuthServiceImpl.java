package com.example.demo.service.impl;

import com.example.demo.domain.dto.RegisterDTO;
import com.example.demo.domain.entity.User;

public class AuthServiceImpl {
    public void register(RegisterDTO dto) {
        User user = new User();
        user.setUserAccount(dto.getUsername());
    }
}
