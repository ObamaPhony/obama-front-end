var router = require("express").Router();
var util = require("../../util");
var db = require("../../database");
var mongo = require("mongodb");
module.exports = router;

var status = util.status;
var analyse = require("./sources").analyse;

/* GET /:id/:topic/:topic/:count */
router.get(/^\/(.+?)\/([A-Za-z\/]+\/[0-9]+)$/, function (request, response) {
    /*
     * should return 'count' "constructs" (TODO: paragraphs? sentences?) generated
     * about 'topic', 'topic', etc. for speech id 'id'
     */

    var id = request.params[0], args = request.params[1].split("/");

    if (!mongo.ObjectId.isValid(id)) {
        status(response, 404);
        return;
    }

    db.collection("sources").findOne({
        _id: mongo.ObjectId(id),
    }, function (err, doc) {
        if (err) {
            status(response, 500);
            return;
        }

        if (doc == null) {
            status(response, 404);
            return;
        }

        analyse(doc, function (doc) {
            util.spawn("./bin/generate", JSON.stringify(doc.analysis), function (json) {
                db.collection("generated").ensureIndex({
                    expires: 1
                }, {
                    expireAfterSeconds: 2 * 60 * 60
                }, function (err) {
                    if (err) {
                        status(response, 500);
                        return;
                    }

                    db.collection("generated").insert({
                        createdAt: new Date(),
                        constructs: json /* TODO: paragraphs? sentences */
                    }, function (err, result) {
                        if (err) {
                            status(response, 500);
                            return;
                        }

                        var doc = result.ops[0]
                        response.json({
                            id: doc._id,
                            constructs: doc.constructs
                        });
                    });
                });
            }, args);
        });
    });
});
