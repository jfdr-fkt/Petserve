import { state } from './state.js';
import { field } from './components.js';
import { escapeHTML as e, money } from './utils.js';

export function paymentDialog(type, id, draft) {
  const visit = state.data.appointments.find((a) => a.id === id);
  if (type === 'online-payment') {
    const methods = Object.entries(state.data.wallets)
      .filter(([, w]) => w.enabled)
      .map(([name]) => name);
    return {
      title: 'Pay from your wallet',
      description: `${visit.petName} · ${visit.serviceName}`,
      label: 'Submit transfer for verification',
      content: `<p class="subtle-note">Check the wallet details below, then enter the amount and transaction reference.</p>${field('Wallet', 'method', draft.method || methods[0], { choices: methods, required: true })}<div id="wallet-details">${walletDetails(draft.method || methods[0])}</div>${field('Amount sent (₱)', 'amount', draft.amount ?? visit.basePrice / 100, { type: 'number', required: true, attrs: 'min="0.01" max="1000000" step="0.01"' })}${field('Transaction reference', 'reference', draft.reference, { required: true, attrs: 'minlength="6" maxlength="60" pattern="(?:[a-zA-Z0-9]|-){6,60}"', placeholder: 'Reference from your wallet receipt' })}<p class="form-footnote">Payment is marked paid after the care team confirms receipt in the shop’s wallet.</p>`,
    };
  }
  if (type === 'transfer-review') {
    const transfer = visit.paymentRequest;
    return {
      title: 'Review the online transfer',
      description: `${visit.customerName} · ${visit.petName}`,
      label: 'Save verification result',
      content: `<dl class="wallet-details"><div><dt>Wallet</dt><dd>${e(transfer.method)}</dd></div><div><dt>Amount submitted</dt><dd>${money(transfer.amount)}</dd></div><div><dt>Transaction reference</dt><dd>${e(transfer.reference)}</dd></div><div><dt>Sent to</dt><dd>${e(transfer.wallet.name)} · ${e(transfer.wallet.number)}</dd></div></dl>${field(
        'Review result',
        'status',
        draft.status || 'verified',
        {
          choices: [
            ['verified', 'Verify received payment'],
            ['rejected', 'Reject submission'],
          ],
        },
      )}<label class="upload-consent"><input type="checkbox" name="received"><span>I checked the shop’s wallet and confirmed that this amount and reference were received.</span></label>${field('Note to the customer', 'note', draft.note, { type: 'textarea', attrs: 'maxlength="300"', hint: 'Required when rejecting a transfer. Include what the customer should correct.' })}`,
    };
  }
  if (type === 'payment-settings') {
    return {
      title: 'Online payment details',
      description: 'Use the shop’s verified GCash and Maya accounts.',
      label: 'Save wallet details',
      content: ['GCash', 'Maya']
        .map((method) => {
          const wallet = state.data.wallets[method];
          return `<section class="wallet-setup"><h3>${method}</h3>${field(
            'Accept transfers',
            `${method}-enabled`,
            String(wallet.enabled),
            {
              choices: [
                ['false', 'Off'],
                ['true', 'On'],
              ],
            },
          )}${field('Account name', `${method}-name`, wallet.name, { attrs: 'maxlength="80"' })}${field('Mobile number', `${method}-number`, wallet.number, { type: 'tel', attrs: 'maxlength="11" pattern="09[0-9]{9}"', placeholder: '09XXXXXXXXX' })}${field('Instructions (optional)', `${method}-instructions`, wallet.instructions, { type: 'textarea', attrs: 'maxlength="300"' })}</section>`;
        })
        .join(''),
    };
  }
  return null;
}
export function walletDetails(method) {
  const wallet = state.data.wallets[method];
  return wallet
    ? `<dl class="wallet-details"><div><dt>Account name</dt><dd>${e(wallet.name)}</dd></div><div><dt>${e(method)} number</dt><dd>${e(wallet.number)}</dd></div>${wallet.instructions ? `<div><dt>From the shop</dt><dd>${e(wallet.instructions)}</dd></div>` : ''}</dl>`
    : '';
}
