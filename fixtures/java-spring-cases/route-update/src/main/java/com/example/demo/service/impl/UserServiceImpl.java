package com.example.demo.service.impl;

import com.example.demo.domain.dto.UserStatusDTO;
import com.example.demo.domain.entity.User;
import com.example.demo.service.UserService;

public class UserServiceImpl implements UserService {
    public boolean updateUserStatus(Long id, UserStatusDTO dto) {
        User user = requireUser(id);
        user.setStatus(dto.getStatus());
        return userMapper.updateById(user) > 0;
    }
}
