/*
 * Copyright (c) 2014, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jshint node:true */
'use strict';

var fs = require('fs');
var glob = require('glob');
var path = require('path');
var when = require('when');
var url = require('url');

var FakeResponse = {
    _items: [],

    preload: function(pathToConfiguration) {
        return when.promise(function(resolve, reject) {
            var configDir = pathToConfiguration || path.join(__dirname, 'default_routes');
            console.log('loading config from: ',configDir);
            glob.sync('*.json', {cwd:configDir})
                .forEach(function eachFile(file) {
                    var contents = fs.readFileSync(path.join(configDir,file), 'utf8');
                    try {
                        var allRoutes = JSON.parse(contents);
                        allRoutes.routes.forEach(function(configLine) {
                            FakeResponse.add(configLine);
                        });
                    } catch(e) {
                        console.log('Wrong configuration format');
                        reject(e);
                    }
                });
            return resolve(FakeResponse.getAll());
        });
    },

    getAll: function () {
        return FakeResponse._items;
    },

    add: function (item) {
        item.numCalls = 0;
        FakeResponse._items.push(item);
    },

    flush: function () {
        FakeResponse._items = [];
    },

    /* Filters all items that match the URL and then tries to check if there is a specific behavior for the Nth call on the same endpoint */
    match: function (uri, payload, headers) {
        uri = url.parse(uri, true);

        return FakeResponse._items.filter(function (item) {
            var doPathsMatch = uri.pathname.match(new RegExp(item.route));

            if (doPathsMatch !== null) {
                item.numCalls += 1;
                if(item.queryParams && !FakeResponse.matchRegex(item.queryParams, uri.query)) return false;
                if(item.payload && !FakeResponse.matchRegex(item.payload, payload)) return false; 
                if(item.requiredHeaders && !FakeResponse.matchRegex(item.requiredHeaders, headers)) return false;
                if (item.at) return (item.numCalls === item.at); 
                return true;
            }
            return false;
        }).reduce(function (previous, match) {
            if (match.at || previous === 0) {
                return match;
            }
        }, 0);
    },

    /*
     * Match objB's values against regular expressions stored in objA. Key equality determines values to test.
     * @param {objA} An object whose string values represent regular expressions
     * @param {objB} An object whose values will be matched against objA's values
     * @return {boolean} If objB matches all regular expressions
     */
    matchRegex: function(objA, objB) {
        if (typeof(objB) !== "object" || typeof(objA) !== "object") return false;

        for (var ppty in objA) {
            if (!objA.hasOwnProperty(ppty) || !objB.hasOwnProperty(ppty)) return false;

            // Evalute regex match
            var matches = String(objB[ppty]).match(new RegExp(objA[ppty]));
            if (matches == null) return false;
        }
        return true;
    }
};

module.exports = FakeResponse;
