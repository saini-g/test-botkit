const connFactory = require('../util/connection-factory');
const { saveTeamId } = require('../util/refedge');
const logger = require('../util/logger');

module.exports = controller => {

    controller.webserver.get('/sfauth/callback', async (req, res) => {

        try {

            if (req.query.error) {
                logger.log('salesforce auth error:', req.query.error);
                res.status(401);
                res.json({ ok: true, msg: 'salesforce auth failed' });
                // res.sendFile('/auth-failed.html');
            }

            if (req.query.code && req.query.state) {
                let conn = await connFactory.connect(req.query.code, controller, req.query.state);
                let teamData = { addTeam: req.query.state };
                saveTeamId(conn, teamData);
                res.status(302);
                res.json({ ok: true, msg: 'salesforce auth successful' });
                // res.redirect('/auth-success.html');
            }
        } catch (err) {
            logger.log('salesforce auth error:', err);
        }
    });
}