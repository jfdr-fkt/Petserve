import { state } from './js/state.js';
import { api, toast, uploadMedia } from './js/api.js';
import { shell, navigation } from './js/shell.js';
import { auth } from './js/views/auth.js';
import { overview } from './js/views/overview.js';
import { pets } from './js/views/pets.js';
import { staff, positionStaffChart } from './js/views/staff.js';
import { booking, dateOptions, slotPicker } from './js/views/booking.js';
import { appointments, payments } from './js/views/appointments.js';
import { schedule, services, accounts, account, reports } from './js/views/clinic.js';
import { dialogContent } from './js/dialogs.js';
import { gallery, feedback } from './js/views/community.js';
import { uploadPreview } from './js/community-dialogs.js';
import { icon } from './js/components.js';
import { todayManila } from './js/utils.js';
import { createInterface } from '../client/interface.jsx';
import { chat } from './js/views/chat.js';
import {
  startChat,
  stopChat,
  sendChat,
  searchChat,
  clearChatAttachment,
  chooseChatAttachment,
  deleteChatMessage,
} from './js/chat.js';
import { applyTheme } from './js/themes.js';
import { loginWelcome, logoutGoodbye } from './js/session-scenes.js';
import { walletDetails } from './js/payment-dialogs.js';
import { careItems, careSelectionError, planPreview } from './js/booking-plan.js';
import { chooseProfilePhoto, removeProfilePhoto } from './js/profile.js';
import { deleteConversation } from './js/chat.js';
import {
  handleScheduleClick,
  handleScheduleChange,
  handleCalendarKey,
} from './js/schedule-calendar.js';
import { handlePlanInput, handlePlanSubmit } from './js/shift-planner.js';
import { startScheduleUpdates, stopScheduleUpdates } from './js/schedule-updates.js';
import './js/experience.js';

const root = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const ui = createInterface(root, modalRoot);
const views = {
  overview,
  pets,
  staff,
  book: booking,
  appointments,
  payments,
  schedule,
  services,
  accounts,
  account,
  reports,
  gallery,
  feedback,
  chat,
};
let focusBeforeDialog = null;
let slotRequest = 0;
let navigationRequest = 0;

function render() {
  if (!state.data) return;
  if (!state.data.user) {
    ui.auth(auth());
    closeDialog();
    return;
  }
  if (!navigation().some(([view]) => view === state.view)) state.view = 'overview';
  ui.workspace(shell(views[state.view]()));
  if (state.view === 'staff') positionStaffChart();
  if (!state.dialog) renderDialog();
}
function renderDialog(focus = false) {
  ui.dialog(dialogContent(), `${state.dialog?.type}-${state.dialog?.id}`);
  root.inert = Boolean(state.dialog);
  document.body.classList.toggle('dialog-open', Boolean(state.dialog));
  if (focus && state.dialog) {
    requestAnimationFrame(() =>
      modalRoot.querySelector('input:not([type=file]), textarea, select, button')?.focus(),
    );
  }
}
function openDialog(type, id = '', draft = {}, status = '') {
  if (state.mobileMenuOpen) setMobileMenu(false);
  focusBeforeDialog = document.activeElement;
  state.dialog = { type, id, status };
  state.draft = { ...draft };
  renderDialog(true);
}
function closeDialog() {
  const wasOpen = Boolean(state.dialog);
  state.dialog = null;
  ui.dialog('', '');
  if (state.mediaPreview) URL.revokeObjectURL(state.mediaPreview);
  state.mediaFile = null;
  state.mediaPreview = '';
  state.draft = {};
  root.inert = false;
  document.body.classList.remove('dialog-open');
  if (wasOpen) {
    if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus();
    else document.querySelector('#main-content')?.focus({ preventScroll: true });
  }
}
async function refresh() {
  state.data = await api('/api/bootstrap');
  if (state.authMode === 'reset' && state.resetToken) state.data.user = null;
  render();
}
async function finishSession(deleted = false) {
  navigationRequest++;
  stopChat();
  stopScheduleUpdates();
  clearChatAttachment();
  slotRequest++;
  setMobileMenu(false);
  Object.assign(state, {
    data: { user: null },
    view: 'overview',
    authMode: 'login',
    accountPhoto: null,
    recoveryResult: null,
    resetToken: '',
    resetComplete: false,
    report: null,
    reportFrom: '',
    reportTo: '',
    scheduleDate: '',
    scheduleMonth: '',
    scheduleMode: '',
    scheduleEmployeeId: '',
    shiftPlans: {},
    selectedPet: '',
    search: '',
    filter: 'all',
    notifications: false,
    chatCustomerId: '',
    chatMessages: [],
    chatDraft: '',
    chatSearch: '',
    chatLoading: false,
    chatSending: false,
    slots: [],
    slotsLoading: false,
    slotError: '',
  });
  state.booking = { serviceId: 'grooming', petId: '', petIds: [], date: '', time: '', note: '' };
  history.replaceState(null, '', '#overview');
  render();
  await logoutGoodbye(root, deleted);
  window.scrollTo(0, 0);
  root.querySelector('[name="email"]')?.focus({ preventScroll: true });
}
async function navigate(view, { filter = 'all', date } = {}) {
  const request = ++navigationRequest;
  if (view !== 'account') state.accountPhoto = null;
  stopChat();
  stopScheduleUpdates();
  setMobileMenu(false);
  closeDialog();
  state.view = view;
  state.search = '';
  state.filter = filter;
  if (view === 'schedule' && date) {
    state.scheduleDate = date;
    state.scheduleMonth = date.slice(0, 7);
    state.scheduleMode = 'visits';
  }
  state.notifications = false;
  history.replaceState(null, '', `#${view}`);
  if (view === 'book') {
    state.booking.time = '';
    state.slots = [];
    state.slotError = '';
    if (!state.booking.date) state.booking.date = dateOptions()[0] || '';
  }
  if (view === 'schedule') {
    const data = await api('/api/bootstrap');
    if (request !== navigationRequest) return;
    state.data = data;
  }
  render();
  if (view === 'book') await loadSlots();
  if (view === 'reports') await loadReport();
  if (request !== navigationRequest) return;
  if (view === 'chat') startChat();
  if (view === 'schedule') startScheduleUpdates(render);
  document.querySelector('#main-content')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
function setMobileMenu(open) {
  state.mobileMenuOpen = open;
  root.querySelector('.app-shell')?.classList.toggle('mobile-menu-open', open);
  const main = root.querySelector('.main-shell');
  if (main) main.inert = open;
  const sidebar = root.querySelector('.sidebar');
  if (sidebar) sidebar.inert = window.innerWidth <= 720 && !open;
  document.body.classList.toggle('navigation-open', open);
  root.querySelector('.mobile-menu-toggle')?.setAttribute('aria-expanded', String(open));
  if (open) root.querySelector('.sidebar-mobile-close')?.focus();
  else root.querySelector('.mobile-menu-toggle')?.focus({ preventScroll: true });
}
async function loadSlots() {
  const version = ++slotRequest;
  const b = state.booking;
  state.slotsLoading = true;
  state.slotError = '';
  state.slots = [];
  b.time = '';
  updateSlots();
  if (!b.date) {
    state.slotsLoading = false;
    updateSlots();
    return;
  }
  const bulk = b.bulk && state.view === 'book' && !state.dialog;
  if (bulk && careSelectionError()) {
    state.slotsLoading = false;
    state.slotError = careSelectionError();
    updateSlots();
    return;
  }
  const params = new URLSearchParams({ date: b.date, serviceId: b.serviceId });
  if (state.dialog?.type === 'reschedule') params.set('appointmentId', state.dialog.id);
  try {
    const result = bulk
      ? await api('/api/care-plans/availability', 'POST', { date: b.date, items: careItems() })
      : await api(`/api/availability?${params}`);
    if (version !== slotRequest) return;
    state.slots = result.slots;
  } catch (error) {
    if (version !== slotRequest) return;
    state.slotError = error.message;
  } finally {
    if (version === slotRequest) {
      state.slotsLoading = false;
      updateSlots();
    }
  }
}
function updateSlots() {
  const picker = document.querySelector('#slot-picker');
  if (picker) picker.innerHTML = slotPicker();
  const preview = document.querySelector('#care-plan-preview');
  if (preview) preview.innerHTML = planPreview();
  const submit = document.querySelector(
    'form[data-form="booking"] [type=submit], form[data-form="reschedule"] [type=submit]',
  );
  if (submit) submit.disabled = !state.booking.time || state.slotsLoading;
}
async function loadReport() {
  try {
    const params = new URLSearchParams();
    if (state.reportFrom) params.set('from', state.reportFrom);
    if (state.reportTo) params.set('to', state.reportTo);
    state.report = await api(`/api/report?${params}`);
    if (state.view === 'reports') render();
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleClick(event) {
  const button = event.target.closest('button, a');
  if (!button || button.disabled) return;
  if (button.dataset.view) {
    event.preventDefault();
    await navigate(button.dataset.view, {
      filter: button.dataset.routeFilter,
      date: button.dataset.routeDate,
    });
    return;
  }
  if (button.dataset.authMode) {
    state.authMode = button.dataset.authMode;
    state.recoveryResult = null;
    state.resetComplete = false;
    render();
    return;
  }
  if (button.dataset.fill) {
    state.authMode = 'login';
    render();
    root.querySelector('[name=email]').value = {
      customer: 'alex@example.test',
      staff: 'staff@petserve.test',
      admin: 'admin@petserve.test',
    }[button.dataset.fill];
    root.querySelector('[name=password]').value = 'Petserve123!';
    root.querySelector('[name=email]').focus();
    return;
  }
  if (button.dataset.species) {
    state.petSpecies = button.dataset.species;
    render();
    return;
  }
  if (button.dataset.petTab) {
    state.petTab = button.dataset.petTab;
    render();
    return;
  }
  if (button.dataset.filter) {
    state.filter = button.dataset.filter;
    render();
    return;
  }
  if (button.dataset.service) {
    if (state.booking.bulk) {
      const b = state.booking,
        serviceId = button.dataset.service;
      const remove = b.petIds.length
        ? b.petIds.every((id) => b.care[id].includes(serviceId))
        : b.serviceIds.includes(serviceId);
      b.serviceIds = remove
        ? b.serviceIds.filter((id) => id !== serviceId)
        : [...new Set([...b.serviceIds, serviceId])];
      for (const id of b.petIds)
        b.care[id] = remove
          ? b.care[id].filter((item) => item !== serviceId)
          : [...new Set([...b.care[id], serviceId])];
      b.time = '';
      render();
      await loadSlots();
      return;
    }
    state.booking.serviceId = button.dataset.service;
    state.booking.time = '';
    if (state.booking.serviceId !== 'consultation') state.booking.petIds = [state.booking.petId];
    render();
    await loadSlots();
    return;
  }
  if (button.dataset.bookPet) {
    const petId = button.dataset.bookPet;
    const selected = state.booking.petIds;
    if (state.booking.bulk) {
      if (selected.includes(petId)) state.booking.petIds = selected.filter((id) => id !== petId);
      else if (selected.length < 30) {
        selected.push(petId);
        state.booking.care[petId] ||= [...state.booking.serviceIds];
      } else {
        toast('Choose up to thirty pets for one care request.');
        return;
      }
      state.booking.time = '';
      render();
      await loadSlots();
      return;
    }
    if (state.booking.serviceId === 'consultation') {
      if (selected.includes(petId)) {
        if (selected.length > 1) state.booking.petIds = selected.filter((id) => id !== petId);
      } else if (selected.length < 6) state.booking.petIds.push(petId);
      else {
        toast('A shared consultation can include up to six pets.');
        return;
      }
    } else state.booking.petIds = [petId];
    state.booking.petId = state.booking.petIds[0];
    render();
    return;
  }
  if (button.dataset.date) {
    state.booking.date = button.dataset.date;
    state.booking.time = '';
    render();
    await loadSlots();
    return;
  }
  if (button.dataset.time) {
    if (!state.slots.some((s) => s.time === button.dataset.time && s.available)) return;
    state.booking.time = button.dataset.time;
    if (state.dialog?.type === 'reschedule') updateSlots();
    else render();
    return;
  }
  const action = button.dataset.action,
    id = button.dataset.id;
  if (!action) return;
  try {
    if (await handleScheduleClick(button, render, refresh)) return;
    if (
      [
        'availability',
        'block-add',
        'block-remove',
        'shift-add',
        'shift-edit',
        'shift-remove',
      ].includes(action) &&
      state.data.user.role !== 'admin'
    )
      throw new Error('Only administrators can change the schedule.');
    if (action === 'reschedule' && state.data.user.role === 'staff')
      throw new Error('Ask your administrator to reschedule this visit.');
    if (['online-payment', 'transfer-review', 'payment-settings'].includes(action)) {
      openDialog(action, id);
      return;
    }
    if (action === 'chat-select') {
      clearChatAttachment();
      state.chatCustomerId = id;
      state.chatMessages = [];
      state.chatDraft = '';
      state.chatLoading = true;
      state.chatForceScroll = true;
      render();
      startChat();
      return;
    }
    if (action === 'chat-open') {
      clearChatAttachment();
      state.chatCustomerId = state.data.user.role === 'customer' ? state.data.user.id : id;
      state.chatMessages = [];
      state.chatDraft = '';
      state.chatLoading = true;
      await navigate('chat');
      return;
    }
    if (action === 'chat-attachment-remove') {
      clearChatAttachment();
      return;
    }
    if (action === 'chat-message-delete') {
      openDialog('chat-delete', id);
      return;
    }
    if (action === 'chat-clear') {
      openDialog('chat-clear', state.chatCustomerId);
      return;
    }
    if (action === 'account-photo-remove') {
      removeProfilePhoto();
      return;
    }
    if (action === 'password-change') {
      openDialog('password-change');
      return;
    }
    if (action === 'password-reset-link') {
      const result = await api(`/api/users/${id}/password-reset`, 'POST', {});
      openDialog('password-reset-link', id, result);
      return;
    }
    if (action === 'reset-open') {
      event.preventDefault();
      state.authMode = 'reset';
      state.resetToken = button.dataset.token;
      history.replaceState(null, '', `#reset-password/${state.resetToken}`);
      render();
      return;
    }
    if (action === 'account-delete') {
      openDialog('account-delete', id);
      return;
    }
    if (action === 'sidebar-toggle') {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      root
        .querySelector('.app-shell')
        ?.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
      button.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
      button.setAttribute(
        'aria-label',
        state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
      );
      button.innerHTML = icon(state.sidebarCollapsed ? 'expand' : 'collapse');
      try {
        localStorage.setItem('petserve-sidebar-collapsed', String(state.sidebarCollapsed));
      } catch {}
      return;
    }
    if (action === 'mobile-menu') {
      setMobileMenu(true);
      return;
    }
    if (action === 'sidebar-close') {
      setMobileMenu(false);
      return;
    }
    if (action === 'gallery-upload') {
      openDialog('gallery-upload');
      return;
    }
    if (action === 'pet-media-upload') {
      openDialog('pet-media-upload', id);
      return;
    }
    if (action === 'staff-add') {
      openDialog('staff-member');
      return;
    }
    if (action === 'staff-edit' || action === 'staff-remove') {
      const member = state.data.staffDirectory.find((entry) => entry.id === id);
      openDialog(action === 'staff-edit' ? 'staff-member' : 'staff-remove', id, member);
      return;
    }
    if (action === 'pet-media-view') {
      openDialog('pet-media-view', id);
      return;
    }
    if (action === 'pet-media-remove') {
      openDialog(
        'pet-media-remove',
        id,
        state.data.petMedia.find((item) => item.id === id),
      );
      return;
    }
    if (action === 'gallery-remove') {
      openDialog(
        'gallery-remove',
        id,
        state.data.gallery.find((m) => m.id === id),
      );
      return;
    }
    if (action === 'feedback-write') {
      openDialog(
        'feedback-write',
        id,
        state.data.feedback.find((f) => f.appointmentId === id) || {},
      );
      return;
    }
    if (action === 'feedback-reply') {
      openDialog('feedback-reply', id, {
        text: state.data.feedback.find((f) => f.id === id)?.reply?.text || '',
      });
      return;
    }
    if (action === 'logout') {
      button.disabled = true;
      await api('/api/auth/logout', 'POST', {});
      await finishSession();
      return;
    }
    if (action === 'notifications') {
      state.notifications = !state.notifications;
      render();
      return;
    }
    if (action === 'dialog-close') {
      closeDialog();
      return;
    }
    if (action === 'pet-add') {
      openDialog('pet', '', { species: 'Dog' });
      return;
    }
    if (action === 'pet-edit') {
      openDialog(
        'pet',
        id,
        state.data.pets.find((p) => p.id === id),
      );
      return;
    }
    if (action === 'pet-select') {
      state.selectedPet = id;
      if (state.view !== 'pets') await navigate('pets');
      else render();
      return;
    }
    if (action === 'health-add') {
      openDialog('health', id, { type: 'vaccine', date: todayManila() });
      return;
    }
    if (action === 'pet-archive') {
      openDialog(
        'archive',
        id,
        state.data.pets.find((p) => p.id === id),
      );
      return;
    }
    if (action === 'photo-remove') {
      state.draft.photoUrl = '';
      renderDialog();
      return;
    }
    if (action === 'book-pet') {
      state.booking.bulk = false;
      state.booking.petId = id;
      state.booking.petIds = [id];
      await navigate('book');
      return;
    }
    if (action === 'book-service') {
      state.booking.bulk = false;
      state.booking.serviceId = id;
      await navigate('book');
      return;
    }
    if (action === 'book-again') {
      const appointment = state.data.appointments.find((a) => a.id === id);
      state.booking.petId = appointment.petId;
      state.booking.petIds = [...appointment.petIds];
      state.booking.serviceId = appointment.serviceId;
      state.booking.bulk = false;
      state.booking.serviceIds = [appointment.serviceId];
      await navigate('book');
      return;
    }
    if (action === 'status-open') {
      openDialog('status', id, {}, button.dataset.status);
      return;
    }
    if (action === 'care-status-open') {
      openDialog('care-status', id, {}, button.dataset.status);
      return;
    }
    if (action === 'payment') {
      openDialog('payment', id);
      return;
    }
    if (action === 'receipt') {
      openDialog('receipt', id);
      return;
    }
    if (action === 'print') {
      window.print();
      return;
    }
    if (action === 'reschedule') {
      const appointment = state.data.appointments.find((a) => a.id === id);
      state.booking = {
        ...state.booking,
        serviceId: appointment.serviceId,
        date: appointment.date,
        time: '',
      };
      state.slots = [];
      openDialog('reschedule', id);
      await loadSlots();
      return;
    }
    if (action === 'availability') {
      openDialog('availability');
      return;
    }
    if (action === 'shift-add' || action === 'shift-edit') {
      openDialog(
        'shift',
        id,
        id
          ? state.data.shifts.find((shift) => shift.id === id)
          : { employeeId: state.scheduleEmployeeId },
      );
      return;
    }
    if (action === 'shift-remove') {
      openDialog('shift-remove', id);
      return;
    }
    if (action === 'block-add') {
      openDialog('block');
      return;
    }
    if (action === 'block-remove') {
      button.disabled = true;
      await api(`/api/schedule/blocks/${id}`, 'DELETE');
      await refresh();
      toast('This time is open again.');
      return;
    }
    if (action === 'service-edit') {
      openDialog(
        'service',
        id,
        state.data.services.find((s) => s.id === id),
      );
      return;
    }
    if (action === 'user-edit') {
      openDialog(
        'user',
        id,
        state.data.users.find((u) => u.id === id),
      );
      return;
    }
    if (action === 'schedule-today') {
      state.scheduleDate = todayManila();
      render();
      return;
    }
    if (action === 'find-appointment') {
      const appointment = state.data.appointments.find((a) => a.id === id);
      await navigate('appointments');
      state.search = appointment.petName;
      render();
      return;
    }
    if (action === 'report-reset') {
      state.reportFrom = '';
      state.reportTo = '';
      await loadReport();
      return;
    }
    if (action === 'report-export') {
      exportReport();
      return;
    }
  } catch (error) {
    button.disabled = false;
    toast(error.message, true);
  }
}
root.addEventListener('click', handleClick);
modalRoot.addEventListener('click', handleClick);

function handleInput(event) {
  const target = event.target;
  if (handlePlanInput(target)) return;
  if (target.name === 'chatText') {
    state.chatDraft = target.value;
    return;
  }
  if (target.name === 'chatSearch') {
    searchChat(target.value);
    return;
  }
  if (target.name === 'search') {
    const start = target.selectionStart,
      end = target.selectionEnd;
    state.search = target.value;
    render();
    const input = root.querySelector('[name=search]');
    input?.focus();
    input?.setSelectionRange(start, end);
    return;
  }
  if (modalRoot.contains(target) && target.name && target.type !== 'file')
    state.draft[target.name] = target.value;
  if (target.closest('form[data-form="booking"]') && target.name === 'note')
    state.booking.note = target.value;
}
root.addEventListener('input', handleInput);
modalRoot.addEventListener('input', handleInput);
async function handleChange(event) {
  const target = event.target;
  if (handleScheduleChange(target, render)) return;
  if (target.name === 'kind' && state.dialog?.type === 'shift') {
    state.draft = Object.fromEntries(new FormData(target.form).entries());
    renderDialog();
    document.getElementById('shift-kind')?.focus();
    return;
  }
  if (
    target.id === 'booking-multiple' ||
    target.id === 'booking-all-pets' ||
    target.dataset.carePet
  ) {
    const b = state.booking,
      focused = target.id;
    if (target.id === 'booking-multiple') {
      if (!target.checked) b.serviceId = b.care[b.petIds[0]]?.[0] || b.serviceIds[0] || b.serviceId;
      b.bulk = target.checked;
      b.serviceIds = [b.serviceId];
      b.care = Object.fromEntries(b.petIds.map((id) => [id, [b.serviceId]]));
      if (!b.bulk) b.petIds = b.petIds.slice(0, 1);
    } else if (target.id === 'booking-all-pets') {
      b.petIds = target.checked ? state.data.pets.slice(0, 30).map((pet) => pet.id) : [];
      for (const id of b.petIds) b.care[id] ||= [...b.serviceIds];
    } else {
      const id = target.dataset.carePet,
        service = target.dataset.careService;
      b.care[id] = target.checked
        ? [...new Set([...b.care[id], service])]
        : b.care[id].filter((item) => item !== service);
    }
    b.time = '';
    render();
    document.getElementById(focused)?.focus({ preventScroll: true });
    await loadSlots();
    return;
  }
  if (target.id === 'theme-select') {
    applyTheme(target.value);
    return;
  }
  if (target.id === 'chat-file') {
    try {
      chooseChatAttachment(target.files?.[0]);
    } catch (error) {
      target.value = '';
      toast(error.message, true);
    }
    return;
  }
  if (target.name === 'method' && state.dialog?.type === 'online-payment') {
    state.draft.method = target.value;
    const details = document.querySelector('#wallet-details');
    if (details) details.innerHTML = walletDetails(target.value);
    return;
  }
  if (target.id === 'gallery-file' || target.id === 'pet-media-file') {
    const file = target.files?.[0];
    if (state.mediaPreview) URL.revokeObjectURL(state.mediaPreview);
    state.mediaFile = null;
    state.mediaPreview = '';
    if (
      file &&
      (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type) ||
        file.size > 25 * 1024 * 1024)
    ) {
      target.value = '';
      toast('Choose a JPG, PNG, WebP, MP4 or WebM file up to 25 MB.', true);
    } else if (file) {
      state.mediaFile = file;
      state.mediaPreview = URL.createObjectURL(file);
    }
    const preview = document.querySelector('#upload-preview');
    if (preview) preview.innerHTML = uploadPreview();
    return;
  }
  if (target.id === 'pet-photo') {
    await importPhoto(target.files?.[0]);
    return;
  }
  if (target.id === 'account-photo') {
    try {
      await chooseProfilePhoto(target.files?.[0]);
    } catch (error) {
      toast(error.message, true);
      target.value = '';
    }
    return;
  }
  if (target.id === 'booking-date' || target.id === 'reschedule-date') {
    state.booking.date = target.value;
    state.booking.time = '';
    if (target.id === 'booking-date') render();
    await loadSlots();
  }
}
root.addEventListener('change', handleChange);
modalRoot.addEventListener('change', handleChange);

async function importPhoto(file) {
  if (!file) return;
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  ) {
    toast('Choose a JPG, PNG or WebP photo up to 10 MB.', true);
    return;
  }
  const currentDialog = state.dialog;
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    if (state.dialog !== currentDialog) return;
    state.draft.photoUrl = canvas.toDataURL('image/jpeg', 0.86);
    renderDialog();
    toast('Photo added. Save the profile to keep it.');
  } catch {
    toast('This photo could not be read. Try another image.', true);
  }
}

async function handleSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === 'shift-plan') {
    handlePlanSubmit(form, render);
    return;
  }
  const submit = form.querySelector('[type=submit]');
  if (submit.disabled) return;
  const values = Object.fromEntries(new FormData(form).entries()),
    id = form.dataset.id;
  const errorBox = form.querySelector('.form-error');
  if (errorBox) errorBox.hidden = true;
  submit.disabled = true;
  let message = '';
  const submitLabel = submit.textContent;
  try {
    switch (form.dataset.form) {
      case 'chat':
        await sendChat(values.chatText);
        submit.disabled = false;
        return;
      case 'chat-delete':
        await deleteChatMessage(id);
        closeDialog();
        toast('Message deleted.');
        return;
      case 'chat-clear':
        await deleteConversation(id, values.confirm === 'on');
        closeDialog();
        toast('Conversation deleted.');
        return;
      case 'password-reset-link':
        closeDialog();
        return;
      case 'password-change':
        await api('/api/account/password', 'PATCH', values);
        message = 'Your password has been updated.';
        break;
      case 'forgot-password':
        state.recoveryResult = await api('/api/auth/forgot-password', 'POST', values);
        render();
        return;
      case 'reset-password':
        await api('/api/auth/reset-password', 'POST', { ...values, token: state.resetToken });
        state.authMode = 'login';
        state.resetToken = '';
        state.recoveryResult = null;
        state.resetComplete = true;
        state.data = { user: null };
        history.replaceState(null, '', '#overview');
        render();
        return;
      case 'account-delete': {
        const result = await api(id ? `/api/users/${id}` : '/api/account', 'DELETE', {
          password: values.password,
          confirm: values.confirm === 'on',
        });
        closeDialog();
        if (result.signedOut) {
          await finishSession(true);
          return;
        }
        message = 'Account deleted.';
        break;
      }
      case 'online-payment':
        await api(`/api/appointments/${id}/online-payment`, 'POST', values);
        message = 'Transfer submitted. The team will verify the payment.';
        break;
      case 'transfer-review': {
        const request = state.data.appointments.find((a) => a.id === id).paymentRequest;
        await api(`/api/payment-requests/${request.id}`, 'PATCH', {
          ...values,
          received: values.received === 'on',
        });
        message =
          values.status === 'verified'
            ? 'Transfer verified. The receipt is ready.'
            : 'The customer can correct and resubmit their transfer.';
        break;
      }
      case 'payment-settings': {
        const settings = Object.fromEntries(
          ['GCash', 'Maya'].map((method) => [
            method,
            {
              enabled: values[`${method}-enabled`] === 'true',
              name: values[`${method}-name`],
              number: values[`${method}-number`],
              instructions: values[`${method}-instructions`],
            },
          ]),
        );
        await api('/api/payment-settings', 'PATCH', settings);
        message = 'Online payment details saved.';
        break;
      }
      case 'feedback-write':
        await api(`/api/appointments/${id}/feedback`, 'POST', values);
        message = 'Thank you. Your feedback has been shared with the care team.';
        break;
      case 'feedback-reply':
        await api(`/api/feedback/${id}/reply`, 'PATCH', values);
        message = 'Reply saved for the customer.';
        break;
      case 'gallery-upload':
        if (!state.mediaFile) throw new Error('Choose a photo or short video.');
        submit.textContent = 'Posting to gallery…';
        await uploadMedia(state.mediaFile, {
          caption: values.caption,
          serviceId: values.serviceId,
          permission: String(values.permission === 'on'),
        });
        message = 'Your photo or video is now in the Petopia gallery.';
        break;
      case 'gallery-remove':
        await api(`/api/gallery/${id}`, 'DELETE');
        message = 'Gallery post removed.';
        break;
      case 'pet-media-upload':
        if (!state.mediaFile) throw new Error('Choose a photo or short video.');
        submit.textContent = 'Saving to pet album…';
        await uploadMedia(
          state.mediaFile,
          { caption: values.caption || '' },
          `/api/pets/${id}/media`,
        );
        state.petTab = 'media';
        message = 'Saved to this pet’s album.';
        break;
      case 'staff-member':
        await api(id ? `/api/staff/${id}` : '/api/staff', id ? 'PATCH' : 'POST', values);
        message = 'Staff list updated.';
        break;
      case 'staff-remove':
        await api(`/api/staff/${id}`, 'DELETE', { confirm: true });
        message = 'Staff member removed.';
        break;
      case 'pet-media-remove':
        await api(`/api/pets/${state.draft.petId}/media/${id}`, 'DELETE');
        message = 'Photo or video removed.';
        break;
      case 'auth': {
        await api(
          state.authMode === 'register' ? '/api/auth/register' : '/api/auth/login',
          'POST',
          values,
        );
        state.view = 'overview';
        const [data] = await Promise.allSettled([api('/api/bootstrap'), loginWelcome(root)]);
        if (data.status === 'rejected') throw data.reason;
        state.data = data.value;
        state.mobileMenuOpen = false;
        history.replaceState(null, '', '#overview');
        render();
        document.querySelector('#main-content')?.focus({ preventScroll: true });
        window.scrollTo(0, 0);
        return;
      }
      case 'pet': {
        const result = await api(id ? `/api/pets/${id}` : '/api/pets', id ? 'PATCH' : 'POST', {
          ...values,
          photoUrl: state.draft.photoUrl || '',
        });
        state.selectedPet = result.pet.id;
        state.petSpecies = 'all';
        state.search = '';
        state.petTab = 'profile';
        message = id ? 'Profile refreshed.' : 'A new companion, all set.';
        break;
      }
      case 'health':
        await api(`/api/pets/${id}/health-logs`, 'POST', values);
        state.petTab = 'health';
        message = 'Care record saved.';
        break;
      case 'archive':
        await api(`/api/pets/${id}`, 'DELETE');
        state.selectedPet = '';
        message = 'Profile archived. Visit history is kept.';
        break;
      case 'booking':
        if (!state.booking.time) throw new Error('Choose an available time.');
        if (state.booking.bulk) {
          if (careSelectionError()) throw new Error(careSelectionError());
          await api('/api/care-plans', 'POST', {
            date: state.booking.date,
            time: state.booking.time,
            note: state.booking.note,
            items: careItems(),
          });
        } else await api('/api/appointments', 'POST', state.booking);
        state.booking.note = '';
        state.booking.date = '';
        state.booking.time = '';
        state.view = 'appointments';
        state.filter = 'pending';
        state.search = '';
        history.replaceState(null, '', '#appointments');
        message = 'Request sent. The care team will confirm your visit.';
        break;
      case 'care-status':
        await api(`/api/care-plans/${id}/status`, 'PATCH', {
          ...values,
          status: state.dialog.status,
        });
        message = 'Care request updated.';
        break;
      case 'status':
        await api(`/api/appointments/${id}/status`, 'PATCH', {
          ...values,
          status: state.dialog.status,
        });
        message =
          state.dialog.status === 'completed'
            ? 'Completed care saved to their visit history.'
            : 'Appointment updated.';
        break;
      case 'reschedule':
        if (!state.booking.time) throw new Error('Choose an available time.');
        await api(`/api/appointments/${id}/reschedule`, 'PATCH', {
          date: values.date,
          time: state.booking.time,
        });
        message = 'New time requested for review.';
        break;
      case 'payment':
        await api(`/api/appointments/${id}/payment`, 'POST', values);
        message = 'Payment recorded. Their receipt is ready.';
        break;
      case 'availability':
        await api('/api/schedule', 'PATCH', {
          weekdays: new FormData(form).getAll('weekday').map(Number),
          timeSlots: new FormData(form).getAll('slot'),
        });
        message = 'Opening days and times updated.';
        break;
      case 'block':
        await api('/api/schedule/blocks', 'POST', values);
        message = 'Time blocked for this care team.';
        break;
      case 'shift':
        await api(
          id ? `/api/schedule/shifts/${id}` : '/api/schedule/shifts',
          id ? 'PATCH' : 'POST',
          values,
        );
        message = 'Employee shift saved.';
        break;
      case 'shift-remove':
        await api(`/api/schedule/shifts/${id}`, 'DELETE');
        message = 'Employee shift removed.';
        break;
      case 'service':
        await api(`/api/services/${id}`, 'PATCH', {
          ...values,
          active: values.active === 'true',
        });
        message = 'Service menu updated.';
        break;
      case 'user':
        await api(`/api/users/${id}`, 'PATCH', {
          role: values.role,
          disabled: values.disabled === 'true',
        });
        message = 'Account access updated.';
        break;
      case 'account':
        await api('/api/account', 'PATCH', {
          ...values,
          photoUrl: state.accountPhoto ?? state.data.user.photoUrl,
        });
        state.accountPhoto = null;
        message = 'Your details are up to date.';
        break;
      case 'report': {
        const params = new URLSearchParams(values);
        const report = await api(`/api/report?${params}`);
        state.reportFrom = values.from;
        state.reportTo = values.to;
        state.report = report;
        render();
        return;
      }
      default:
        throw new Error('This form could not be saved.');
    }
    await refresh();
    closeDialog();
    if (state.view === 'reports') await loadReport();
    toast(message);
  } catch (error) {
    if (errorBox) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: 'nearest' });
    } else toast(error.message, true);
    submit.disabled = false;
    submit.textContent = submitLabel;
  }
}
root.addEventListener('submit', handleSubmit);
modalRoot.addEventListener('submit', handleSubmit);

function exportReport() {
  const r = state.report;
  const rows = [
    [
      'PetServe report',
      'Visit date from',
      state.reportFrom || 'All',
      'Visit date to',
      state.reportTo || 'All',
    ],
    [],
    ['Appointments', r.totalAppointments],
    ['Completed services', r.servicesCompleted],
    ['Recorded collections (PHP)', r.amountCollected / 100],
    ['Payments recorded', r.paymentsRecorded],
    ['Awaiting payment record', r.outstanding],
    [],
    ['Status', 'Count'],
    ...Object.entries(r.counts),
    [],
    ['Service', 'Bookings', 'Completed', 'Collections (PHP)'],
    ...r.services.map((s) => [s.name, s.bookings, s.completed, s.collected / 100]),
  ];
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          let text = String(value ?? '');
          if (/^[=+@-]/.test(text)) text = "'" + text;
          return '"' + text.replaceAll('"', '""') + '"';
        })
        .join(','),
    )
    .join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `petserve-report-${todayManila()}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener('keydown', (event) => {
  handleCalendarKey(event);
  if (
    event.target.id === 'chat-text' &&
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.isComposing
  ) {
    event.preventDefault();
    event.target.form.requestSubmit();
    return;
  }
  if (state.mobileMenuOpen && !state.dialog) {
    if (event.key === 'Escape') {
      setMobileMenu(false);
      return;
    }
    if (event.key === 'Tab') {
      const controls = [...root.querySelectorAll('.sidebar a, .sidebar button')].filter(
        (el) => el.getClientRects().length,
      );
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    return;
  }
  if (!state.dialog) return;
  if (event.key === 'Escape') {
    closeDialog();
    return;
  }
  if (event.key === 'Tab') {
    const controls = [
      ...modalRoot.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled):not([aria-hidden="true"]), textarea:not(:disabled), [tabindex="0"]',
      ),
    ];
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
window.addEventListener('hashchange', () => {
  const resetToken = /^#reset-password\/([a-f0-9]{64})$/.exec(location.hash)?.[1];
  if (resetToken) {
    stopChat();
    clearChatAttachment();
    closeDialog();
    setMobileMenu(false);
    state.authMode = 'reset';
    state.resetToken = resetToken;
    state.resetComplete = false;
    state.data = { user: null };
    render();
    return;
  }
  const view = location.hash.slice(1);
  if (state.data?.user && views[view]) navigate(view).catch((error) => toast(error.message, true));
});
root.addEventListener(
  'error',
  (event) => {
    if (
      event.target instanceof HTMLImageElement &&
      !event.target.src.endsWith('/assets/dog.svg') &&
      !event.target.src.endsWith('/assets/cat.svg')
    )
      event.target.src = '/assets/dog.svg';
  },
  true,
);

try {
  state.sidebarCollapsed = localStorage.getItem('petserve-sidebar-collapsed') === 'true';
} catch {}
window.addEventListener('resize', () => {
  if (state.mobileMenuOpen && window.innerWidth > 720) setMobileMenu(false);
  const sidebar = root.querySelector('.sidebar');
  if (sidebar) sidebar.inert = window.innerWidth <= 720 && !state.mobileMenuOpen;
  positionStaffChart();
});
document.fonts.ready.then(positionStaffChart);
state.view = views[location.hash.slice(1)] ? location.hash.slice(1) : 'overview';
const recoveryRoute = /^#reset-password\/([a-f0-9]{64})$/.exec(location.hash);
if (recoveryRoute) {
  state.authMode = 'reset';
  state.resetToken = recoveryRoute[1];
}
refresh()
  .then(async () => {
    if (state.data.user && ['book', 'reports', 'chat', 'schedule'].includes(state.view))
      await navigate(state.view);
  })
  .catch(() => {
    ui.auth(
      `<div class="loading-screen"><h1>Let’s reconnect.</h1><p>PetServe could not be reached. Start the server and reload the page.</p><button type="button" class="btn btn-primary" id="retry">Try again</button></div>`,
    );
    document.querySelector('#retry').addEventListener('click', () => location.reload());
  });
