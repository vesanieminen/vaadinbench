package com.example.customers.web;

import java.util.List;

import com.example.customers.domain.Customer;
import com.example.customers.domain.CustomerSort;
import com.example.customers.service.CustomerService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The customer API the React frontend talks to.
 *
 * <pre>
 * GET /api/customers?offset=0&amp;limit=50&amp;sort=lastName:asc   one page of customers
 * GET /api/customers/count                                total number of customers
 * </pre>
 *
 * <p>{@code sort} may be repeated; each value is a property, a colon and a
 * direction, {@code asc} or {@code desc}, and they apply in order. (A colon
 * rather than a comma: Spring splits a comma-separated parameter into a list.)
 */
@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    public List<Customer> list(
            @RequestParam int offset,
            @RequestParam int limit,
            @RequestParam(name = "sort", required = false) List<String> sort) {
        return customerService.list(offset, limit, toSorts(sort));
    }

    @GetMapping("/count")
    public int count() {
        return customerService.count();
    }

    private static List<CustomerSort> toSorts(List<String> sort) {
        if (sort == null) {
            return List.of();
        }
        return sort.stream()
                .map(value -> {
                    String[] parts = value.split(":", 2);
                    boolean ascending = parts.length < 2 || !parts[1].equalsIgnoreCase("desc");
                    return new CustomerSort(parts[0], ascending);
                })
                .toList();
    }
}
