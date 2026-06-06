package com.example.demo.controller;

import com.example.demo.domain.dto.RegisterDTO;
import com.example.demo.domain.common.ResultUtils;
import com.example.demo.service.AuthService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public void register(@RequestBody RegisterDTO dto) {
        ResultUtils.success(authService.register(dto));
    }
}
