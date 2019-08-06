const mongoose = require('mongoose');

module.exports = config => {

    if (!config) {
        throw new Error('missing options');
    }

    if (!config.mongoUri && !config.db) {
        throw new Error('missing db uri/instance');
    }
    mongoose.set('useNewUrlParser', true);
    mongoose.set('useFindAndModify', false);
    let db = config.db || mongoose.createConnection(config.mongoUri);
    let storage = {};
    let tables = ['teams', 'channels', 'orgs'];

    tables.forEach(tab => {
        let model = createModel(db, tab);
        storage[tab] = setupStorage(model, tab);
    });
    return storage;
};

function createModel(db, table) {
    const schema = new mongoose.Schema({}, {
        strict: false,
        collection: table
    });

    try {
        return db.model(table, schema);
    } catch (err) {

        if (err.name === 'OverwriteModelError') {
            return db.model(table);
        } else {
            throw(err);
        }
    }
}

function setupStorage(tableModel, tabelName) {
    return {
        get: async (id) => {

            try {
                const result = await tableModel.findOne({ id: id });

                if (!result) {
                    return null;
                    //throw new Error(`${tabelName} not found for id ${id}`);
                }
                return result._doc;
            } catch (err) {
                throw err;
            }
        },
        save: async (data) => {

            try {
                await tableModel.findOneAndUpdate(
                    { id: data.id },
                    data,
                    { upsert: true, new: true });
                return 'success';
            } catch (err) {
                throw err;
            }
        },
        all: async () => {

            try {
                const result = await tableModel.find({});
                return result.map(d => d._doc);
            } catch (err) {
                throw err;
            }
        },
        delete: async (id) => {

            try {
                await tableModel.deleteOne({ id: id });
                return 'success';
            } catch (err) {
                throw err;
            }
        },
        find: async (data, options) => {

            try {
                const result = await tableModel.find(data, null, options);
                return result.map(d => d._doc);
            } catch (err) {
                throw err;
            }
        }
    };
}