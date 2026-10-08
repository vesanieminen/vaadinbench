package com.example.customers.domain;

/**
 * A single sort instruction understood by {@link CustomerRepository}.
 *
 * @param property  one of {@code id}, {@code firstName}, {@code lastName},
 *                  {@code email}, {@code country}, {@code status}
 * @param ascending {@code true} for ascending order
 */
public record CustomerSort(String property, boolean ascending) {
}
