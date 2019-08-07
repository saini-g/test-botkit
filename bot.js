require('dotenv').config();

const { Botkit } = require('botkit');
const { SlackAdapter, SlackMessageTypeMiddleware, SlackEventMiddleware } = require('botbuilder-adapter-slack');
const dialogflowMiddleware = require('botkit-middleware-dialogflow')();

const mongoProvider = require('./db/mongo-provider')({
    mongoUri: process.env.MONGO_CONNECTION_STRING
});
const authRouter = require('./routes/oauth');
const sfAuthRouter = require('./routes/sf-oauth');
const sfMsgRouter = require('./routes/msg-handler');

const adapter = new SlackAdapter({
    clientSigningSecret: process.env.SLACK_SIGNING_SECRET,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    scopes: ['bot', 'team:read', 'users:read', 'users:read.email', 'channels:write'],
    redirectUri: process.env.SLACK_REDIRECT_URI,
    getTokenForTeam: getTokenForTeam,
    getBotUserByTeam: getBotUserByTeam
});
adapter.use(new SlackEventMiddleware());
adapter.use(new SlackMessageTypeMiddleware());

const controller = new Botkit({
    webhook_uri: '/slack/receive',
    adapter
});

controller.addPluginExtension('database', mongoProvider);

controller.middleware.receive.use(dialogflowMiddleware.receive);

controller.ready(() => {
    controller.loadModules(__dirname + '/dialogs');
    controller.loadModules(__dirname + '/listeners');

    authRouter(controller);
    sfAuthRouter(controller);
    sfMsgRouter(controller);
});

async function getTokenForTeam(teamId) {

    try {
        const teamData = await controller.plugins.database.teams.get(teamId);

        if (!teamData) {
            console.log('team not found for id: ', teamId);
        }
        return teamData.bot.token;
    } catch (err) {
        console.log(err);
    }
}

async function getBotUserByTeam(teamId) {

    try {
        const teamData = await controller.plugins.database.teams.get(teamId);

        if (!teamData) {
            console.log('team not found for id: ', teamId);
        }
        return teamData.bot.user_id;
    } catch (err) {
        console.log(err);
    }
}

process.on('uncaughtException', err => {
    console.log('uncaught exception encountered, exiting process', err.stack);
    process.exit(1);
});