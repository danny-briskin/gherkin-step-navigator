const { Given } = require('@cucumber/cucumber');

Given('the JavaScript user has {int} widgets', function (count) {
    return count;
});
