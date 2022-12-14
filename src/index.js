/**
 * Copyright (c) 2017 - Yev Vlasenko
 */
const cssText = 'position:fixed;pointer-events:none;z-index:-9999;opacity:0;'
const copyErrorMessage = 'Failed to copy value to clipboard. Unknown type.'

const requestClipboardPermission = (onSuccess) => {
  navigator.permissions
    .query({ name: 'clipboard-write' })
    .then((result) => {
      if (result.state === 'granted' || result.state === 'prompt') {
        onSuccess(result)
      }
    })
    .catch((error) => {
      console.warn(error)
    })
}

const $clipboard = (input) => {
  let value

  if (typeof input !== 'string') {
    try {
      value = JSON.stringify(input)
    } catch (e) {
      throw copyErrorMessage
    }
  } else {
    value = input
  }

  const textarea = document.createElement('textarea')

  textarea.addEventListener('focusin', (event) => {
    event.stopPropagation()
  })
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.cssText = cssText

  document.body.appendChild(textarea)

  if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
    textarea.contentEditable = true
    textarea.readOnly = true

    const range = document.createRange()

    range.selectNodeContents(textarea)

    const selection = window.getSelection()

    selection.removeAllRanges()
    selection.addRange(range)
    textarea.setSelectionRange(0, 999999)
  } else {
    textarea.select()
  }

  let success = false

  try {
    success = document.execCommand('copy')

    if (!success) {
      requestClipboardPermission(() => {
        navigator.clipboard.writeText(value).then(
          () => {
            /* clipboard successfully set */
          },
          (error) => {
            console.warn(error)
          }
        )
      })
    }
  } catch (err) {
    console.warn(err)
  }

  document.body.removeChild(textarea)

  return success
}

export default {
  install(app) {
    // Vue v2.x compat
    const globalCtx =
      app.version[0] === '3' ? app.config.globalProperties : app.prototype
    globalCtx.$clipboard = $clipboard

    const generateId = (
      (id) => () =>
        '$' + id++
    )(1)
    const handlers = {}

    const removeHandler = (id) => {
      if (id) {
        handlers[id] = null
        delete handlers[id]
      }
    }

    const addHandler = (func) => {
      const id = generateId()
      handlers[id] = func

      return id
    }

    app.directive('clipboard', {
      beforeMount(el, binding) {
        const { arg, value } = binding

        switch (arg) {
          case 'error':
            const errorHandlerId = addHandler(value)
            el.dataset.clipboardErrorHandler = errorHandlerId
            return

          case 'success':
            const successHandlerId = addHandler(value)
            el.dataset.clipboardSuccessHandler = successHandlerId
            return

          default:
            const clickEventHandler = (event) => {
              if (binding.hasOwnProperty('value')) {
                const payload = {
                  value: typeof value === 'function' ? value() : value,
                  event
                }

                const handlerId = $clipboard(payload.value)
                  ? el.dataset.clipboardSuccessHandler
                  : el.dataset.clipboardErrorHandler

                const handler = handlers[handlerId]

                if (handler) {
                  handler(payload)
                }
              }
            }

            const clickEventHandlerId = addHandler(clickEventHandler)

            el.dataset.clipboardClickHandler = clickEventHandlerId
            el.addEventListener('click', handlers[clickEventHandlerId])

            return
        }
      },

      unmounted(el) {
        const {
          clipboardSuccessHandler,
          clipboardErrorHandler,
          clipboardClickHandler
        } = el.dataset

        removeHandler(clipboardSuccessHandler)
        removeHandler(clipboardErrorHandler)

        if (clipboardClickHandler) {
          el.removeEventListener('click', handlers[clipboardClickHandler])
          removeHandler(clipboardClickHandler)
        }
      },

      // Vue v2.x compat
      get bind() {
        return this.beforeMount
      },
      get unbind() {
        return this.unmounted
      }
    })
  }
}
