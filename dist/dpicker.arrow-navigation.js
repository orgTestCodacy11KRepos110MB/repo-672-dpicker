(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
function positionInParent(children) {
    return [].indexOf.call(children.parentNode.children, children);
}
function left(td, table) {
    var previous = td.previousElementSibling;
    if (previous && previous.querySelector('button')) {
        return previous.querySelector('button').focus();
    }
    previous = td.parentNode.previousElementSibling;
    previous = previous ? previous.querySelector('td:last-child button') : null;
    if (previous) {
        return previous.focus();
    }
    var last = table.querySelector('tr:last-child').querySelectorAll('td.dpicker-active');
    return last[last.length - 1].querySelector('button').focus();
}
function right(td, table) {
    var next = td.nextElementSibling;
    if (next && next.querySelector('button')) {
        return next.querySelector('button').focus();
    }
    next = td.parentNode.nextElementSibling;
    next = next ? next.querySelector('td:first-child button') : null;
    if (next) {
        return next.focus();
    }
    return table.querySelector('tr:first-child').nextElementSibling.querySelectorAll('td.dpicker-active')[0].querySelector('button').focus();
}
function upOrDown(td, table, direction) {
    var position = positionInParent(td);
    var sibling = (direction === 'up' ? 'previous' : 'next') + 'ElementSibling';
    var previousOrNext = td.parentNode[sibling];
    previousOrNext = previousOrNext ? previousOrNext.children[position] : null;
    if (previousOrNext && previousOrNext.classList.contains('dpicker-active')) {
        return previousOrNext.querySelector('button').focus();
    }
    var lastOrFirst = table.querySelector('tr:' + (direction === 'up' ? 'last-child' : 'first-child'));
    while (lastOrFirst) {
        if (lastOrFirst.children[position].classList.contains('dpicker-active')) {
            return lastOrFirst.children[position].querySelector('button').focus();
        }
        lastOrFirst = lastOrFirst[sibling];
    }
}
function up(td, table) {
    return upOrDown(td, table, 'up');
}
function down(td, table) {
    return upOrDown(td, table, 'down');
}
function DayKeyDown(evt) {
    var key = evt.which || evt.keyCode;
    if (key > 40 || key < 37) {
        return;
    }
    evt.preventDefault();
    var td = evt.target.parentNode;
    var table = td.parentNode.parentNode;
    switch (key) {
    case 37: {
            return left(td, table);
        }
    case 39: {
            return right(td, table);
        }
    case 38: {
            return up(td, table);
        }
    case 40: {
            return down(td, table);
        }
    }
}
if (!DPicker) {
    throw new ReferenceError('DPicker is required for this extension to work');
}
DPicker.modules.arrowNavigation = { events: { dayKeyDown: DayKeyDown } };
},{}]},{},[1]);
