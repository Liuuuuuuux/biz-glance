package com.example.demo.service;

import com.example.demo.domain.dto.RegisterDTO;

public interface AuthService {
    Object register(RegisterDTO dto);
}
