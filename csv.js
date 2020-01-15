// There is a bit of magic in the require call for a plugin.
// You can choose from a whitelist of internal system objects.
// If the required file is not in that list, it will be required from disk.
const lrsPlugin = require('./utils/plugins/lrsPlugin.js');
//This is probably not quite what you were expecting. This relates to how we sandbox plugins
const stringify = require(process.cwd() + '/plugins/csvExport/node_modules/csv-stringify')
// When requiring a node_module, if the compiled LRS uses that module, it will be returned from the compiled bundle.
// Otherwise, you'll need to make sure to npm install it alongside the plugin.
const express = require('express');

// Define the column headings and the path to the cooresponding value in the statement.
const columns = {
  'Statement ID': 'id',
  'Actor ID': 'actor.account.name',
  'Actor Name': 'actor.name',
  'Verb ID': 'verb.id',
  'Activity ID': 'object.id',
  'Activity Type': 'object.definition.type',
  'Complete': 'result.completion',
  'Success': 'result.success',
  'Duration': 'result.duration',
  'Response': 'result.response',
  'Score': 'result.score.scaled',
  'Timestamp': 'timestamp',
  'Registration': 'context.registration',
  'Platform': 'context.platform',
  'Grouping Activity ID': 'context.contextActivities.grouping.0.id',
  'Grouping Activity Type': 'context.contextActivities.grouping.0.definition.type',
  'Parent Activity ID': 'context.contextActivities.parent.0.id',
  'Parent Activity Type': 'context.contextActivities.parent.0.definition.type',
};

module.exports = class CSVExporter extends lrsPlugin {
    constructor(lrs, dal, settings) {
        super(lrs, dal, settings);
        // put an export link on the LRS sidebar
        this.on('lrsSidebar', (event, lrs) => ({
            text: 'CSV Export',
            href: this.getLink('/export', 'lrs'), // get a link to this plugin's lrs scoped router
            id: this.uuid,
        }));
        // Set up an Express Router to handle the request
        const router = express.Router();
        // Get the export link
        router.get('/export', async (req, res, next) => {
            const connectionPool = require('./utils/connectionPool.js');
            const DAL = await connectionPool.dal(this.lrs.uuid, this.lrs.strict, this.lrs.preferRead);
            const Mongo = DAL.db;
            const statements = Mongo.collection('statements');
            const cursor = statements.find({});
            const stringifier = stringify({
                delimiter: ','
            })
            stringifier.pipe(res);
            res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');

            // Send the column headers
            stringifier.write(Object.keys(columns));

            // Send rows for each statement
            cursor.each((err, item) => {
                if (item == null) {
                    return res.end();
                }

                const statement = item.statement;
				const values = Object.values(columns).map((column) => get(column, statement));
				stringifier.write(values);
            });
        });
        // Associate the router with the plugin at the LRS level
        this.setRouter('lrs', router);
    }
    // Metadata for display
    static get display() {
        return {
            title: 'CSV Exporter',
            description: 'A write CSV files to a HTTP stream.',
        };
    }
    // Additional metadata for display
    static get metadata() {
        return {
            author: 'Veracity Technology Consultants',
            version: '1.0.0',
            moreInfo: 'https://www.veracity.it',
        };
    }
    // No form is necessary, since there are no per instance settings.
    static get settingsForm() {
        return [
        ];
    }
};

/**
 * Safely retrieves a value from a nested object following the specified path.
 * 
 * For example, if you have the following object:
 * 
 *    const example = {
 *      verb: {
 *        id: "abc123"
 *      }
 *    }
 * 
 * To get the verb ID, you'd typically call `example.verb.id`. However, if `verb` was null,
 * `example.verb.id` would genereate an error ("cannot get property id of undefined").
 * To _safely_ get that value, without first checking for its existence:
 * 
 *    get('verb.id', example)
 * 
 * @param {string} path A dot-delimeted string describing the path to the desired value (e.g. "verb.id").
 * @param {*} source The source object.
 */
function get(path, source) {
  if (typeof path !== 'string' || !source) {
    return null;
  }

  return path
    .split('.')
    .reduce((value, key) => value && value[key] ? value[key] : null, source);
}

module.exports.pluginName = "csvExport";
