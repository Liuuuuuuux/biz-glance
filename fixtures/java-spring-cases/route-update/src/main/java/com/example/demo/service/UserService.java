package com.example.demo.service;

import com.example.demo.domain.dto.UserStatusDTO;

public interface UserService {
    boolean updateUserStatus(Long id, UserStatusDTO dto);
}
