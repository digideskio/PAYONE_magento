/**
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the GNU General Public License (GPL 3)
 * that is bundled with this package in the file LICENSE.txt
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade Payone_Core to newer
 * versions in the future. If you wish to customize Payone_Core for your
 * needs please refer to http://www.payone.de for more information.
 *
 * @category        Payone
 * @package         js
 * @subpackage      payone
 * @copyright       Copyright (c) 2012 <info@noovias.com> - www.noovias.com
 * @author          Matthias Walter <info@noovias.com>
 * @license         <http://www.gnu.org/licenses/> GNU General Public License (GPL 3)
 * @link            http://www.noovias.com
 */

/**
 * PAYONE Service CreditCardCheck
 *
 * @param config
 * @constructor
 */
PAYONE.Service.CreditCardCheck = function (handler, form, config) {
    this.handler = handler;
    this.form = form;
    this.config = config;
    this.origMethod = '';

    /**
     * Enhances payment.save and runs Validate and CreditCardCheck for CreditCards
     * @todo rename this method?
     * @param origMethod
     */
    this.exec = function (origMethod) {
        var check = this.handler.haveToValidate();

        if (check == 1) {
            this.handler.origMethod = origMethod;
            // Payone credit card payment method is available, and selected, initiate credit card check:
            if (this.validate(this.form)) {
                this.creditcardcheck();
            }
        }
        else {
            origMethod();
        }
    };

    /**
     * Trigger CVC Code as configured
     *
     * @param element
     */
    this.displayCheckCvc = function (element) {
        config = JSON.parse($('payone_creditcard_config_cvc').value);
        ccKey = element.value;
        var cvcDiv = $("payone_creditcard_cc_cid_div");
        if (cvcDiv != undefined && cvcDiv != null) {
            configCcKey = config[ccKey];
            if (configCcKey != undefined && configCcKey != 0) {
                cvcDiv.show();
            }
            else {
                cvcDiv.hide();
            }
        }
    };

    /**
     * Validate the Form Data
     *
     * @param form Form Object
     * @return {*}
     */
    this.validate = function (form) {
        var elementCcType = $('payone_creditcard_cc_type_select');
        if (elementCcType != undefined) {
            var ccTypeConfigKey = elementCcType.value;
            var ccTypeSplit = ccTypeConfigKey.split('_');
            var configId = ccTypeSplit[0];
            var ccType = ccTypeSplit[1];
            $("payone_creditcard_config_id").setValue(configId);
            $("payone_creditcard_cc_type").setValue(ccType);
        }
        config = this.getConfig();
        configValidation = config.validation;

        validation = new PAYONE.Validation.CreditCard(configValidation);
        return validation.validate(form);
    };

    /**
     * Perform creditcard check via Payone Client API
     */
    this.creditcardcheck = function () {
        var configId = $("payone_creditcard_config_id").value;

        config = this.getConfig();
        configGateway = config.gateway[configId];

        var data = this.mapRequestCreditCardCheck();

        var payoneGateway = new PAYONE.Gateway(
            configGateway,
            function (response) {
                return window.payone.handleResponseCreditcardCheck(response);
            }
        );
        payoneGateway.call(data);
    };

    /**
     * Collect PAYONE CreditCardCheck Request Parameters
     *
     * @return {*}
     */
    this.mapRequestCreditCardCheck = function () {
        data = {
            'cardexpiremonth':$('payone_creditcard_cc_expiration_month').value,
            'cardexpireyear':$('payone_creditcard_cc_expiration_year').value,
            'cardholder':$('payone_creditcard_cc_owner').value,
            'cardtype':$('payone_creditcard_cc_type').value,
            'cardpan':$('payone_creditcard_cc_number').value
        };

        cid = $('payone_creditcard_cc_cid');
        if (cid != undefined) {
            data.cardcvc2 = cid.value;
        }

        return data;
    };

    /**
     * Handle response
     *
     * @param response
     * @return {Boolean}
     */
    this.handleResponseCreditcardCheck = function (response) {
        return this.handler.handleResponse(response);
    };

    /**
     * Get Config (auto-initialize)
     *
     * @return {*}
     */
    this.getConfig = function () {
        if (this.config == '' || this.config == undefined) {
            configJson = $('payone_creditcard_config').value;
            this.config = JSON.parse(configJson);
        }
        return this.config;
    };
};

PAYONE.Handler.CreditCardCheck = {};
PAYONE.Handler.CreditCardCheck.OnepageCheckout = function () {
    this.origMethod = '';

    this.haveToValidate = function () {
        var radio_p1_cc = $('p_method_payone_creditcard');
        if (radio_p1_cc != undefined && radio_p1_cc != null && radio_p1_cc.checked) {
            if (checkout.loadWaiting != false) {
                return 0;
            }
            if (payment.validate() != true) {
                return 0;
            }
            return 1;
        }
        return 0;
    };

    this.handleResponse = function (response) {
        if (response.status != 'VALID') {
            // Failure
            alert(response.customermessage);
            checkout.setLoadWaiting(false);
            return false;
        }

        // Success!
        var pseudocardpan = response.pseudocardpan;
        var truncatedcardpan = response.truncatedcardpan;

        $('payone_pseudocardpan').setValue(pseudocardpan);
        $('payone_truncatedcardpan').setValue(truncatedcardpan);
        $('payone_creditcard_cc_number').setValue(truncatedcardpan);

        cid = $('payone_creditcard_cc_cid');
        if (cid != undefined) {
            $('payone_creditcard_cc_cid').setValue('')
        }

        checkout.setLoadWaiting('payment', false);

        // Post payment form to Magento:
        var request = new Ajax.Request(
            payment.saveUrl,
            {
                method:'post',
                onComplete:payment.onComplete,
                onSuccess:payment.onSave,
                onFailure:checkout.ajaxFailure.bind(checkout),
                parameters:Form.serialize(payment.form)
            }
        );
    };
};

PAYONE.Handler.CreditCardCheck.Admin = function () {
    this.origMethod = '';

    this.haveToValidate = function () {
        var radio_p1_cc = $('p_method_payone_creditcard');

        if (radio_p1_cc != undefined && radio_p1_cc != null && radio_p1_cc.checked
            && $('payone_pseudocardpan').value == '') {
            return 1;
        }
        return 0;
    };

    this.handleResponse = function (response) {
        if (response.status != 'VALID') {
            // Failure
            alert(response.customermessage);
            return false;
        }

        // Success!
        var pseudocardpan = response.pseudocardpan;
        var truncatedcardpan = response.truncatedcardpan;

        $('payone_pseudocardpan').setValue(pseudocardpan);
        $('payone_truncatedcardpan').setValue(truncatedcardpan);
        $('payone_creditcard_cc_number').setValue(truncatedcardpan);

        cid = $('payone_creditcard_cc_cid');
        if (cid != undefined) {
            $('payone_creditcard_cc_cid').setValue('')
        }

        // remove validation class cause CreditCard is validated
        // @todo when changing CardData it has to be added again or we exchange the form with labels and provide an edit button
        $('payone_creditcard_cc_number').removeClassName('validate-cc-number');
        $('payone_creditcard_cc_number').removeClassName('validate-payone-cc-type');
        this.origMethod();
    };
};

PAYONE.Validation.CreditCard = function (config) {
    this.config = config;
    this.validationsCc = '';
    this.validationsCcMagento = '';

    this.validate = function (form) {
        this.initValidationType();

        Validation.add('validate-payone-cc-type', 'Credit card number does not match credit card type.', this.validateType, this);
        Validation.add('validate-payone-cc-validity-period', 'Credit card validity period is too short.', this.validateValidityPeriod, this);

        var validator = new Validation(form);
        return validator.validate();
    };

    /**
     * Creditcard Validity Period Validation
     *
     * @param v
     * @param elm
     * @return {Boolean}
     */
    this.validateValidityPeriod = function (v, elm) {
        var year = $('payone_creditcard_cc_expiration_year').value;
        var validityCc = new Date(year, v, 1); // Start of next month

        return validityCc > this.options.get('config').allowed_validity;
    };

    /**
     * Creditcard Type Validation
     *
     * @param v
     * @param elm
     * @return {Boolean}
     */
    this.validateType = function (v, elm) {
        // remove credit card number delimiters such as "-" and space
        elm.value = removeDelimiters(elm.value);
        v = removeDelimiters(v);

        var ccTypeContainer = $(elm.id.substr(0, elm.id.indexOf('_cc_number')) + '_cc_type');
        if (!ccTypeContainer) {
            return true;
        }

        var ccType = ccTypeContainer.value;
        var ccTypeValidator = this.options.get('validationsCc').get(ccType);

        if (typeof ccTypeValidator == 'undefined') {
            return false;
        }

        // Disabled checks:
        if (ccTypeValidator[0] == false) {
            return true;
        }

        // Validate credit card number according to type:
        var result = false;
        if (ccTypeValidator[0] && v.match(ccTypeValidator[0])) {
            result = true;
        }

        if (!result) {
            return false;
        }

        if (ccTypeContainer.hasClassName('validation-failed') && Validation.isOnChange) {
            Validation.validate(ccTypeContainer);
        }

        return true;
    };

    this.initValidationType = function () {
        if (Validation.creditCardTypes) {
            this.validationsCcMagento = Validation.creditCardTypes;
        }
        else if (Validation.creditCartTypes) {
            // typo in certain Magento versions..
            this.validationsCcMagento = Validation.creditCartTypes;
        }

        // validations for Payone credit card types
        this.validationsCc = $H({
            'O':[new RegExp('(^(5[0678])\\d{11,18}$)|(^(6[^0357])\\d{11,18}$)|(^(601)[^1]\\d{9,16}$)|(^(6011)\\d{9,11}$)|(^(6011)\\d{13,16}$)|(^(65)\\d{11,13}$)|(^(65)\\d{15,18}$)|(^(633)[^34](\\d{9,16}$))|(^(6333)[0-4](\\d{8,10}$))|(^(6333)[0-4](\\d{12}$))|(^(6333)[0-4](\\d{15}$))|(^(6333)[5-9](\\d{8,10}$))|(^(6333)[5-9](\\d{12}$))|(^(6333)[5-9](\\d{15}$))|(^(6334)[0-4](\\d{8,10}$))|(^(6334)[0-4](\\d{12}$))|(^(6334)[0-4](\\d{15}$))|(^(67)[^(59)](\\d{9,16}$))|(^(6759)](\\d{9,11}$))|(^(6759)](\\d{13}$))|(^(6759)](\\d{16}$))|(^(67)[^(67)](\\d{9,16}$))|(^(6767)](\\d{9,11}$))|(^(6767)](\\d{13}$))|(^(6767)](\\d{16}$))'),
                new RegExp('^[0-9]{3}$'),
                false],
            'V':this.validationsCcMagento.get('VI'),
            'A':this.validationsCcMagento.get('AE'),
            'M':this.validationsCcMagento.get('MC'),
            'J':this.validationsCcMagento.get('JCB'),
            'C':this.validationsCcMagento.get('DI'),
            'D':this.validationsCcMagento.get('OT'),
            'B':this.validationsCcMagento.get('OT'),
            'U':this.validationsCcMagento.get('OT')
        });
    };

    this.getConfig = function () {
        return this.config;
    };
};
