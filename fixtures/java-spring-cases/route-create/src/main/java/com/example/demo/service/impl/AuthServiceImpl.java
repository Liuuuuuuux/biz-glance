package com.example.demo.service.impl;

import com.example.demo.domain.dto.RegisterDTO;
import com.example.demo.domain.entity.User;
import com.example.demo.service.AuthService;

public class AuthServiceImpl implements AuthService {
    public Object register(RegisterDTO dto) {
        User user = new User();
        user.setUserAccount(dto.getUsername());
        userMapper.insert(user);
        return user;
    }
}
