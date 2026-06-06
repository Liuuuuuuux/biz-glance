package com.example.demo.service.impl;

import com.example.demo.domain.entity.User;
import com.example.demo.service.UserService;

public class UserServiceImpl implements UserService {
    public void save(User user) {
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        userRepository.save(user);
    }
}
