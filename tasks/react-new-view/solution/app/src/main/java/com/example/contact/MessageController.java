package com.example.contact;

import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The messages sent so far, newest first. Held in memory: nothing needs to be
 * stored on disk, but the list belongs to the application rather than to one
 * visit of the view, so it survives leaving the view and reloading the page.
 */
@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final List<ContactMessage> messages = new ArrayList<>();

    @GetMapping
    public synchronized List<ContactMessage> list() {
        return List.copyOf(messages);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public synchronized ContactMessage send(@RequestBody ContactMessage message) {
        messages.addFirst(message);
        return message;
    }
}
