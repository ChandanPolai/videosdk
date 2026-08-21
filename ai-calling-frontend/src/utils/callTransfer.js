/** Match transfer ONLY by call status (same as Status column in UI). */
export const getCallStatus = (call = {}) => String(call?.status || '').trim();

export const isCallTransferred = (call = {}) =>
  getCallStatus(call).toLowerCase() === 'transferred';

export const getCallFrom = (call = {}) =>
  call?.from || call?.sipCallFrom || call?.callerId || '';

export const getCallTo = (call = {}) =>
  call?.to || call?.sipCallTo || call?.destination || '';

/** Customer number: outbound → To, inbound → From */
export const getPrimaryNumber = (call = {}) => {
  const type = String(call?.type || '').toLowerCase();
  if (type === 'inbound') return getCallFrom(call) || getCallTo(call);
  return getCallTo(call) || getCallFrom(call);
};

export const getCallParticipantName = (call = {}) => {
  const meta = call?.metadata && typeof call.metadata === 'object' ? call.metadata : {};
  return (
    meta.name ||
    meta.participantName ||
    meta.customerName ||
    meta.clientName ||
    call?.participantName ||
    call?.customerName ||
    call?.name ||
    ''
  );
};

export const getTransferDestination = (call = {}) => {
  if (!isCallTransferred(call)) return '';
  const meta = call?.metadata && typeof call.metadata === 'object' ? call.metadata : {};
  return (
    call?.transferTo ||
    call?.transferredTo ||
    call?.transferNumber ||
    meta.call_forward_no ||
    meta.transferTo ||
    ''
  );
};
