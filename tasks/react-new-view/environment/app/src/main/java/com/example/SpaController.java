package com.example;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the React application for every client-side route.
 *
 * <p>The frontend is a single-page application: {@code npm run build} writes it
 * to {@code target/classes/static}, and its router owns paths such as
 * {@code /contact}. A browser that opens one of those paths directly asks the
 * server for it, so every single-segment path without a file extension, other
 * than {@code /api}, is answered with {@code index.html} and left to the
 * router. The bundle itself, under {@code /assets}, is served as the files it
 * is.
 */
@Controller
public class SpaController {

    @GetMapping({"/", "/{path:^(?!api$)[^.]*}"})
    public String index() {
        return "forward:/index.html";
    }
}
