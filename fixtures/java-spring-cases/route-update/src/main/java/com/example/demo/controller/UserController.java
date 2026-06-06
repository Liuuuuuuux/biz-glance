package com.example.demo.controller;

import com.example.demo.domain.common.ResultUtils;
import com.example.demo.domain.dto.UserStatusDTO;
import com.example.demo.service.UserService;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/user")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PutMapping("/{id}/status")
    public void updateStatus(@RequestBody UserStatusDTO dto) {
        ResultUtils.success(userService.updateUserStatus(1L, dto));
    }
}
