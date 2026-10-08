package com.example.contact;

/** One message sent through the contact form. */
public record ContactMessage(String name, String email, String phone, String message) {
}
