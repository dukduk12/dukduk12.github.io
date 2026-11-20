(function () {
  "use strict";

  var payloadNode = document.getElementById("post-lock-payload");
  var lock = document.getElementById("post-lock");
  var content = document.getElementById("protected-post-content");
  var form = document.getElementById("post-lock-form");
  if (!lock || !content || !form) return;

  var input = document.getElementById("post-lock-password");
  var remember = document.getElementById("post-lock-remember");
  var status = document.getElementById("post-lock-status");
  var submitButton = form.querySelector("button");
  var storageKey = "content-lock-password";

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("post-lock__status--error", Boolean(isError));
  }

  if (!payloadNode) {
    setStatus("배포 오류: 이 페이지에는 암호화 데이터가 없습니다.", true);
    submitButton.disabled = true;
    return;
  }

  function bytes(value) {
    return Uint8Array.from(atob(value), function (character) { return character.charCodeAt(0); });
  }

  async function decrypt(password) {
    var payload = JSON.parse(payloadNode.textContent);
    var material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    var key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: bytes(payload.salt), iterations: payload.iterations, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    var encrypted = bytes(payload.ciphertext);
    return new TextDecoder().decode(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(payload.iv), tagLength: 128 },
      key,
      encrypted
    ));
  }

  function activateScripts(root) {
    root.querySelectorAll("script").forEach(function (oldScript) {
      var script = document.createElement("script");
      Array.from(oldScript.attributes).forEach(function (attribute) {
        script.setAttribute(attribute.name, attribute.value);
      });
      script.textContent = oldScript.textContent;
      oldScript.replaceWith(script);
    });
  }

  async function unlock(password) {
    content.innerHTML = await decrypt(password);
    activateScripts(content);
    content.hidden = false;
    // The password form has no purpose after a successful unlock. Removing it
    // also prevents theme CSS from accidentally making a hidden lock visible.
    lock.remove();
    document.dispatchEvent(new CustomEvent("post-lock:unlocked", { detail: { root: content } }));
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    setStatus("비밀번호를 확인하고 있습니다…", false);
    submitButton.disabled = true;
    try {
      await unlock(input.value);
      if (remember.checked) sessionStorage.setItem(storageKey, input.value);
      else sessionStorage.removeItem(storageKey);
      input.value = "";
    } catch (_) {
      sessionStorage.removeItem(storageKey);
      setStatus("비밀번호가 올바르지 않습니다. 다시 확인해 주세요.", true);
      input.select();
    } finally {
      submitButton.disabled = false;
    }
  });

  var savedPassword = sessionStorage.getItem(storageKey);
  if (savedPassword) {
    setStatus("저장된 비밀번호로 잠금을 해제하고 있습니다…", false);
    unlock(savedPassword).catch(function () {
      sessionStorage.removeItem(storageKey);
      setStatus("저장된 비밀번호가 올바르지 않습니다. 다시 입력해 주세요.", true);
      input.focus();
    });
  } else {
    input.focus();
  }
})();
