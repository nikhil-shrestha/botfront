import { Accounts } from 'meteor/accounts-base';
import SimpleSchema from 'simpl-schema';
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

import { GlobalSettings } from './globalSettings/globalSettings.collection';
import { passwordComplexityRegex } from './user/user.methods';
import { languages } from '../lib/languages';

const accountSetupSchema = new SimpleSchema(
    {
        firstName: { type: String, min: 1 },
        lastName: { type: String, min: 1 },
        email: {
            type: String,
            regEx: SimpleSchema.RegEx.EmailWithTLD,
        },
        password: {
            type: String,
            custom() {
                return !this.value.match(passwordComplexityRegex) ? 'passwordTooSimple' : null;
            },
        },
        passwordVerify: {
            type: String,
            custom() {
                return this.value !== this.field('password').value ? 'passwordMismatch' : null;
            },
        },
    },
    { tracker: Tracker },
);

const newProjectSchema = new SimpleSchema(
    {
        project: {
            type: String,
            min: 1,
            custom() {
                return !this.value.match(/^[A-Za-z0-9 ]+$/) ? 'projectName' : null;
            },
        },
        language: { type: String, allowedValues: Object.keys(languages) },
    },
    { tracker: Tracker },
);

newProjectSchema.messageBox.messages({
    en: {
        projectName: 'The name can only contain alphanumeric characters',
    },
});

accountSetupSchema.messageBox.messages({
    en: {
        passwordMismatch: 'The passwords are not matching. Make sure you enter the same password in both fields',
        passwordTooSimple: 'Your password should contain at least 9 characters and have uppercase, lowercase, digit and special characters',
    },
});

export { accountSetupSchema, newProjectSchema };


if (Meteor.isServer) {
    Meteor.methods({
        async 'initialSetup'(accountData) {
            check(accountData, Object);

            const empty = await Meteor.callWithPromise('users.checkEmpty');
            if (!empty) {
                throw new Meteor.Error('403', 'Not authorized');
            }

            let spec = process.env.ORCHESTRATOR ? `.${process.env.ORCHESTRATOR}` : '.docker-compose';
            if (process.env.MODE === 'test' || process.env.CI) {
                spec = `${spec}.ci`;
            } else if (process.env.MODE === 'development') {
                spec = `${spec}.dev`;
            }
            let globalSettings = null;

            try {
                globalSettings = JSON.parse(Assets.getText(`default-settings${spec}.json`));
            } catch (e) {
                globalSettings = JSON.parse(Assets.getText('default-settings.json'));
            }

            GlobalSettings.insert({ _id: 'SETTINGS', ...globalSettings });

            const {
                email, password, firstName, lastName,
            } = accountData;
            const userId = Accounts.createUser({
                email,
                password,
                profile: {
                    firstName,
                    lastName,
                },
            });

            // ee-start //
            const { setUpRoles } = await import('./roles/roles');
            const { Roles } = await import('meteor/alanning:roles');
            setUpRoles();
            Roles.createRole('global-admin', { unlessExists: true });
            Roles.addUsersToRoles(userId, ['global-admin'], null);
            // ee-end //
        },
    });
}
