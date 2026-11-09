const API = (window.QUESTLY_API || '').replace(/\/$/, '');
const textArea = document.getElementById('questionText');
const submitBtn = document.getElementById('submitBtn');
const message = document.getElementById('message');
const subtitle = document.getElementById('subtitle');

function showMessage(text, type) {
  message.textContent = text;
  message.className = `message show ${type}`;
}

fetch(API + '/api/info')
  .then(r => r.json())
  .then(info => {
    if (info.className) {
      subtitle.textContent = `Ask anything about "${info.className}". Your question goes straight to the teacher, anonymously.`;
      document.title = `Ask a Question - ${info.className}`;
    }
  })
  .catch(() => {});

submitBtn.addEventListener('click', async () => {
  const text = textArea.value.trim();
  if (!text) {
    showMessage('Please write a question before sending.', 'error');
    return;
  }

  submitBtn.disabled = true;
  message.className = 'message';

  try {
    const res = await fetch(API + '/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();

    if (data.accepted) {
      showMessage('Your question was sent to the teacher anonymously. Thank you!', 'success');
      textArea.value = '';
    } else {
      showMessage(data.reason || 'Your question could not be sent.', 'error');
    }
  } catch (err) {
    showMessage('Something went wrong sending your question. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
