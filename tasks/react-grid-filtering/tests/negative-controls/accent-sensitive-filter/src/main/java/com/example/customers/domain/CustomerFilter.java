package com.example.customers.domain;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * What the customer list is narrowed down to.
 *
 * @param name     whitespace-separated terms; every term must appear in the first
 *                 or the last name, ignoring case and accents. Blank matches all.
 * @param statuses the statuses to show; empty shows every status
 */
public record CustomerFilter(String name, Set<CustomerStatus> statuses) {

    public static final CustomerFilter NONE = new CustomerFilter("", Set.of());

    public CustomerFilter {
        name = name == null ? "" : name;
        statuses = statuses == null || statuses.isEmpty()
                ? Set.of()
                : Set.copyOf(EnumSet.copyOf(statuses));
    }

    public boolean matches(Customer customer) {
        if (!statuses.isEmpty() && !statuses.contains(customer.status())) {
            return false;
        }
        String first = fold(customer.firstName());
        String last = fold(customer.lastName());
        return terms().stream().allMatch(term -> first.contains(term) || last.contains(term));
    }

    private List<String> terms() {
        return Arrays.stream(fold(name).trim().split("\\s+"))
                .filter(term -> !term.isEmpty())
                .toList();
    }

    /** Lower case with the accents taken off, so {@code Mäkinen} folds to {@code makinen}. */
    static String fold(String text) {
        return text.toLowerCase(Locale.ROOT);
    }
}
