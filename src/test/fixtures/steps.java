package com.example;
import io.cucumber.java.en.Given;

public class StepDefinitions {
    @Given("the Java user has {int} apples")
    public void the_user_has_apples(int count) {}
}