import { Hono } from 'hono'

import { getDomains, getPasswords, getBooleanValue } from './utils';
import { newAddress } from './common'

const api = new Hono()

api.get('/api/mails', async (c) => {
    const { address } = c.get("jwtPayload")
    if (!address) {
        return c.json({ "error": "No address" }, 400)
    }
    const { limit, offset } = c.req.query();
    if (!limit || limit < 0 || limit > 100) {
        return c.text("Invalid limit", 400)
    }
    if (!offset || offset < 0) {
        return c.text("Invalid offset", 400)
    }
    const { results } = await c.env.DB.prepare(
        `SELECT * FROM raw_mails where address = ? order by id desc limit ? offset ?`
    ).bind(address, limit, offset).all();
    let count = 0;
    if (offset == 0) {
        const { count: mailCount } = await c.env.DB.prepare(
            `SELECT count(*) as count FROM raw_mails where address = ?`
        ).bind(address).first();
        count = mailCount;
    }
    return c.json({
        results: results,
        count: count
    })
})

api.delete('/api/mails/:id', async (c) => {
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text("User delete email is disabled", 403)
    }
    const { address } = c.get("jwtPayload")
    const { id } = c.req.param();
    const { success } = await c.env.DB.prepare(
        `DELETE FROM raw_mails WHERE address = ? and id = ?`
    ).bind(address, id).run();
    return c.json({
        success: success
    })
})

api.get('/api/settings', async (c) => {
    const { address, address_id } = c.get("jwtPayload")
    if (address_id && address_id > 0) {
        try {
            const db_address_id = await c.env.DB.prepare(
                `SELECT id FROM address where id = ?`
            ).bind(address_id).first("id");
            if (!db_address_id) {
                return c.text("Invalid address", 400)
            }
        } catch (error) {
            return c.text("Invalid address", 400)
        }
    }
    // check address id
    try {
        if (!address_id) {
            const db_address_id = await c.env.DB.prepare(
                `SELECT id FROM address where name = ?`
            ).bind(address).first("id");
            if (!db_address_id) {
                return c.text("Invalid address", 400)
            }
        }
    } catch (error) {
        return c.text("Invalid address", 400)
    }
    // update address updated_at
    try {
        c.env.DB.prepare(
            `UPDATE address SET updated_at = datetime('now') where name = ?`
        ).bind(address).run();
    } catch (e) {
        console.warn("Failed to update address")
    }
    let auto_reply = {};
    if (getBooleanValue(c.env.ENABLE_AUTO_REPLY)) {
        const results = await c.env.DB.prepare(
            `SELECT * FROM auto_reply_mails where address = ? `
        ).bind(address).first();
        if (results) {
            auto_reply = {
                subject: results.subject,
                message: results.message,
                enabled: results.enabled == 1,
                source_prefix: results.source_prefix,
                name: results.name,
            }
        }
    }
    const { count: mailCountV1 } = await c.env.DB.prepare(
        `SELECT count(*) as count FROM mails where address = ?`
    ).bind(address).first();
    const balance = await c.env.DB.prepare(
        `SELECT balance FROM address_sender
            where address = ? and enabled = 1`
    ).bind(address).first("balance");
    return c.json({
        auto_reply: auto_reply,
        address: address,
        has_v1_mails: mailCountV1 && mailCountV1 > 0,
        send_balance: balance || 0,
    });
})

api.post('/api/settings', async (c) => {
    const { address } = c.get("jwtPayload")
    if (!getBooleanValue(c.env.ENABLE_AUTO_REPLY)) {
        return c.text("Auto reply is disabled", 403)
    }
    const { auto_reply } = await c.req.json();
    const { name, subject, source_prefix, message, enabled } = auto_reply;
    if ((!subject || !message) && enabled) {
        return c.text("Invalid subject or message", 400)
    }
    else if (subject.length > 255 || message.length > 255) {
        return c.text("Subject or message too long", 400)
    }
    const { success } = await c.env.DB.prepare(
        `INSERT OR REPLACE INTO
        auto_reply_mails
                (name, address, source_prefix, subject, message, enabled)
        VALUES
                (?, ?, ?, ?, ?, ?)`
    ).bind(name || '', address, source_prefix || '', subject || '', message || '', enabled ? 1 : 0).run();
    if (!success) {
        return c.text("Failed to save settings", 500)
    }
    return c.json({
        success: success
    })
})

api.get('/open_api/settings', async (c) => {
    // check header x-custom-auth
    let needAuth = false;
    const passwords = getPasswords(c);
    if (passwords && passwords.length > 0) {
        const auth = c.req.raw.headers.get("x-custom-auth");
        needAuth = !passwords.includes(auth);
    }
    return c.json({
        "prefix": c.env.PREFIX,
        "domains": getDomains(c),
        "needAuth": needAuth,
        "adminContact": c.env.ADMIN_CONTACT,
        "enableUserCreateEmail": getBooleanValue(c.env.ENABLE_USER_CREATE_EMAIL),
        "enableUserDeleteEmail": getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL),
        "enableAutoReply": getBooleanValue(c.env.ENABLE_AUTO_REPLY),
        "copyright": c.env.COPYRIGHT,
    });
})

api.get('/api/new_address', async (c) => {
    if (!getBooleanValue(c.env.ENABLE_USER_CREATE_EMAIL)) {
        return c.text("New address is disabled", 403)
    }
    let { name, domain } = c.req.query();
    // if no name, generate random name
    if (!name) {
        name = Math.random().toString(36).substring(2, 15);
    }
    return newAddress(c, name, domain, true);
})

api.delete('/api/delete_address', async (c) => {
    if (!getBooleanValue(c.env.ENABLE_USER_DELETE_EMAIL)) {
        return c.text("User delete email is disabled", 403)
    }
    const { address } = c.get("jwtPayload")
    let name = address;
    const { success } = await c.env.DB.prepare(
        `DELETE FROM address WHERE name = ? `
    ).bind(name).run();
    if (!success) {
        return c.text("Failed to delete address", 500)
    }
    const { success: mailSuccess } = await c.env.DB.prepare(
        `DELETE FROM mails WHERE address = ? `
    ).bind(address).run();
    if (!mailSuccess) {
        return c.text("Failed to delete mails", 500)
    }
    const { success: sendAccess } = await c.env.DB.prepare(
        `DELETE FROM address_sender WHERE address = ? `
    ).bind(address).run();
    return c.json({
        success: success && mailSuccess && sendAccess
    })
})

export { api }
