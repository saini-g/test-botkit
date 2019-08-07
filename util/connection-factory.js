const jsforce = require('jsforce');
const { postForm } = require('../util/requests');
const logger = require('../util/logger');

let connectionsCache = {};
const oauth2 = new jsforce.OAuth2({
    clientId: process.env.SF_CLIENT_ID,
    clientSecret: process.env.SF_CLIENT_SECRET,
    redirectUri: `${process.env.APP_BASE_URL}/sfauth/callback`
});

async function findOrgByTeamId(teamId, botController) {

    try {
        let orgData = await botController.plugins.database.orgs.get(teamId);
        return orgData;
    } catch (err) {
        throw err;
    }
}

async function getExistingConnection(teamId, botController) {

    try {
        let connectedOrg = await findOrgByTeamId(teamId, botController);

        if (connectedOrg) {
            let conn = new jsforce.Connection({
                oauth2: oauth2,
                accessToken: connectedOrg.access_token,
                refreshToken: connectedOrg.refresh_token,
                instanceUrl: connectedOrg.instance_url
            });

            conn.on('refresh', (accessToken, res) => {

                try {
                    connectedOrg.access_token = accessToken;
                    saveOrg(connectedOrg, botController);
                } catch (err) {
                    console.log('connection refresh error:', err);
                }
            });
            connectionsCache[teamId] = conn;
            return conn;
        }
        return null;
    } catch (err) {
        throw err;
    }
}

async function saveOrg(data, botController) {

    try {
        await botController.plugins.database.orgs.save(data);
    } catch (err) {
        throw err;
    }
}

async function deleteOrg(teamId, botController) {

    try {
        await botController.plugins.database.orgs.delete(teamId);
        return 'success';
    } catch (err) {
        throw err;
    }
}

module.exports = {
    getAuthUrl: teamId => {
        let authUrl = oauth2.getAuthorizationUrl({ scope: 'api refresh_token web' });
        return (authUrl + '&state=' + teamId);
    },
    getConnection: async (teamId, botController) => {

        if (teamId in connectionsCache) {
            return connectionsCache[teamId];
        }

        try {
            let conn = await getExistingConnection(teamId, botController);
            return conn;
        } catch (err) {
            throw err;
        }
    },
    connect: async (authCode, botController, teamId) => {

        if (teamId in connectionsCache) {
            return connectionsCache[teamId];
        }

        try {
            let conn = await getExistingConnection(teamId, botController);

            if (conn) {
                return conn;
            }
            conn = new jsforce.Connection({ oauth2: oauth2 });
            const userInfo = await conn.authorize(authCode);

            conn.on('refresh', async (accessToken, res) => {
                try {
                    let orgs = await findOrgByTeamId(teamId, botController);

                    if (orgs && orgs.length > 0) {
                        orgs[0].access_token = accessToken;
                        saveOrg(org, botController);
                    }
                } catch (err) {
                    logger.log('connection refresh error:', err);
                }
            });
            let org = {
                id: teamId,
                access_token: conn.accessToken,
                refresh_token: conn.refreshToken,
                instance_url: conn.instanceUrl,
                user_id: userInfo.id,
                org_id: userInfo.organizationId,
                revoke_url: conn.oauth2.revokeServiceUrl
            };
            saveOrg(org, botController);
            connectionsCache[teamId] = conn;
            return conn;
        } catch (err) {
            throw err;
        }
    },
    revoke: async (orgData, botController) => {

        try {
            await postForm(orgData.revokeUrl, { token: orgData.refreshToken });
            delete connectionsCache[orgData.teamId];
            await deleteOrg(orgData.teamId, botController);
            return 'sf token revoke success';
        } catch (err) {
            throw err;
        }
    }
};