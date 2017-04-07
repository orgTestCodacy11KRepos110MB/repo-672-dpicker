const nanomorph = require('nanomorph')
const html = require('bel')
const MomentDateAdapter = require('./adapters/moment.js')

/**
 * uuid generator
 * https://gist.github.com/jed/982883
 */
function uuid () {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, a => (a ^ Math.random() * 16 >> a / 4).toString(16))
}

/**
 * isElementInContainer tests if an element is inside a given id
 * @param {Element} parent a DOM node
 * @param {String} containerId the container id
 */
function isElementInContainer (parent, containerId) {
  while (parent && parent !== document) {
    if (parent.getAttribute('id') === containerId) {
      return true
    }

    parent = parent.parentNode
  }

  return false
}

/**
 * DPicker a simple date picker
 * @class
 * @param {Element} element DOM element where you want the date picker or an input
 * @param {Object} [options={}]
 * @param {Moment} [options.model=moment()] Your own model instance, defaults to moment() (can be set by the `value` attribute on an input, transformed to moment according to the given format)
 * @param {Moment} [options.min=1986-01-01] The minimum date (can be set by the `min` attribute on an input)
 * @param {Moment} [options.max=today+1 year] The maximum date (can be set by the `max` attribute on an input)
 * @param {string} [options.format='DD/MM/YYYY'] The input format, a moment format (can be set by the `format` attribute on an input)
 * @param {string} [options.months=moment.months()] Months array, see also moment.monthsShort()
 * @param {string} [options.days=moment.weekdaysShort()] Days array, see also moment.weekdaysMin()
 * @param {boolean} [options.display=true]
 * @param {boolean} [options.hideOnDayClick=true] Hides the date picker on day click
 * @param {boolean} [options.hideOnDayEnter=true] Hides the date picker when Enter or Escape is hit
 * @param {boolean} [options.siblingMonthDayClick=false] Enable sibling months day click
 * @param {Function} [options.onChange] A function to call whenever the data gets updated
 * @param {string} [options.inputId=uuid|element.getAttribute('id')] The input id, useful to add you own label (can only be set in the initiation phase) If element is an inputand it has an `id` attribute it'll be overriden by it
 * @param {string} [options.inputName='dpicker-input'] The input name. If element is an inputand it has a `name` attribute it'll be overriden by it
 * @param {Array} [options.order=['months', 'years', 'time', 'days']] The dom elements appending order.
 * @param {boolean} [options.concatHoursAndMinutes=false] Use only one select box for both hours and minutes
 * @listens DPicker#hide
 */
function DPicker (element, options = {}) {
  if (!(this instanceof DPicker)) {
    return new DPicker(element, options)
  }

  const {container, attributes} = this._getContainer(element)

  this._container = uuid()
  this._data = {}

  const defaults = {
    months: DPicker._dateAdapter.months(),
    days: DPicker._dateAdapter.weekdays(),
    empty: false,
    valid: true,
    order: ['months', 'years', 'time', 'days'],
    hideOnDayClick: true,
    hideOnEnter: true,
    hideOnOutsideClick: true,
    siblingMonthDayClick: false,
    firstDayOfWeek: DPicker._dateAdapter.firstDayOfWeek()
  }

  for (let i in defaults) {
    if (options[i] !== undefined) {
      this._data[i] = options[i]
      continue
    }

    this._data[i] = defaults[i]
  }

  this._data.inputName = attributes.name ? attributes.name : options.inputName ? options.inputName : 'dpicker-input'
  this._data.inputId = attributes.id ? attributes.id : options.inputId ? options.inputId : uuid()

  this._setData('format', [attributes.format, 'DD/MM/YYYY'])

  this._events = {}
  for (let i in DPicker._events) {
    this._events[i] = DPicker._events[i].bind(this)
  }

  const methods = DPicker._properties

  methods.min = new Date(1986, 0, 1)
  methods.max = DPicker._dateAdapter.setMonth(DPicker._dateAdapter.addYears(new Date(), 1), 11)
  methods.format = this._data.format

  for (let i in methods) {
    this._createGetSet(i)
    if (typeof methods[i] === 'function') {
      this._setData(i, [options[i], methods[i](attributes)])
    } else {
      this._setData(i, [options[i], attributes[i], methods[i]], methods[i] instanceof Date)
    }
  }

  if (attributes.value === undefined || attributes.value === '') {
    this._data.empty = true
  }

  this._setData('model', [attributes.value, options.model, new Date()], true)

  this.onChange = options.onChange

  document.addEventListener('click', this._events.hide)

  document.addEventListener('touchend', (e) => {
    this._events.inputBlur(e)
  })

  this.initialize()

  this._mount(container)
  this.isValid(this._data.model)

  container.id = this._container
  container.addEventListener('keydown', this._events.keyDown)

  let input = container.querySelector('input')
  input.addEventListener('blur', this._events.inputBlur)

  return this
}

DPicker.prototype._setSelected = function (element, test) {
  if (test === true) {
    element.setAttribute('selected', 'selected')
  }

  return element
}

/**
 * _setData is a helper to set this._data values
 * @param {String} key
 * @param {Array} values the first value that is not undefined will be set in this._data[key]
 * @param {Boolean} isMoment whether this value should be a moment instance
 */
DPicker.prototype._setData = function (key, values, isDate = false) {
  for (let i = 0; i < values.length; i++) {
    if (values[i] === undefined || values[i] === '') {
      continue
    }

    if (isDate === false) {
      this._data[key] = values[i]
      break
    }

    if (DPicker._dateAdapter.isValid(values[i])) {
      this._data[key] = values[i]
      break
    }

    this._data[key] = new Date()

    const temp = DPicker._dateAdapter.isValidWithFormat(values[i], this._data.format)

    if (temp !== false) {
      this._data[key] = temp
      break
    }
  }
}

/**
 * Creates getters and setters for a given key
 * When the setter is called we will redraw
 * @param {String} key
 */
DPicker.prototype._createGetSet = function (key) {
  if (DPicker.prototype.hasOwnProperty(key)) {
    return
  }

  Object.defineProperty(DPicker.prototype, key, {
    get: function () {
      return this._data[key]
    },
    set: function (newValue) {
      this._data[key] = newValue
      this.redraw()
    }
  })
}

/**
 * Gives the dpicker container and it's attributes
 * If the container is an input, the parentNode is the container but the attributes are the input's ones
 * @param {Element} container
 */
DPicker.prototype._getContainer = function (container) {
  if (typeof container === 'undefined') {
    throw new ReferenceError('Can not initialize DPicker without a container')
  }

  const attributes = {}
  ;[].slice.call(container.attributes).forEach((attribute) => {
    attributes[attribute.name] = attribute.value
  })

  // small jquery fix: new DPicker($('<input type="datetime" name="mydatetime" autocomplete="off" step="30">'))
  if (container.length !== undefined && container[0]) {
    container = container[0]
  }

  if (container.tagName === 'INPUT') {
    if (!container.parentNode) {
      throw new ReferenceError('Can not initialize DPicker on an input without parent node')
    }

    let parentNode = container.parentNode
    container.parentNode.removeChild(container)
    container = parentNode
    container.classList.add('dpicker')
  }

  return { container, attributes }
}

/**
 * Allows to render more child elements with modules
 * @return Array<VNode>
 */
DPicker.prototype._getRenderChild = function () {
  let children = {
    years: this.renderYears(this._events, this._data),
    months: this.renderMonths(this._events, this._data)
  }

  // add module render functions
  for (let render in DPicker._renders) {
    children[render] = DPicker._renders[render].call(this, this._events, this._data)
  }

  children.days = this.renderDays(this._events, this._data)

  return this._data.order.filter(e => children[e]).map(e => children[e])
}

/**
 * Mount rendered element to the DOM
 */
DPicker.prototype._mount = function (element) {
  this._tree = this.getTree()
  element.appendChild(this._tree)
}

DPicker.prototype.getTree = function () {
  return this.renderContainer(this._events, this._data, [
    this.renderInput(this._events, this._data),
    this.render(this._events, this._data, this._getRenderChild())
  ])
}

/**
 * Checks whether the given model is a valid moment instance
 * This method does set the `.valid` flag by checking min/max allowed inputs
 * Note that it will return `true` if the model is valid even if it's not in the allowed range
 * @param {Moment} date
 * @return {boolean}
 * @TODO rename _checkValidity
 */
DPicker.prototype.isValid = function checkValidity (date) {
  let temp = this.time ? DPicker._dateAdapter.resetSeconds(date) : DPicker._dateAdapter.resetHours(date)

  if (DPicker._dateAdapter.isBefore(temp, this._data.min) || DPicker._dateAdapter.isAfter(temp, this._data.max)) {
    this._data.valid = false
    return true
  }

  this._data.valid = true
  return true
}

/**
 * Render input
 * @method
 * @listens DPicker#inputChange
 * @listens DPicker#inputBlur
 * @listens DPicker#inputFocus
 * @return {H} the rendered virtual dom hierarchy
 */
DPicker.prototype.renderInput = function (events, data, toRender) {
  return html`<input
    id="${data.inputId}"
    value="${data.empty === true ? '' : DPicker._dateAdapter.format(data.model, data.format)}"
    type="text"
    min="${data.min}"
    max="${data.max}"
    format="${data.format}"
    onchange="${events.inputChange}"
    onfocus="${events.inputFocus}"
    name="${data.inputName}"
    aria-invalid="${data.valid}" aria-haspopup
    class="${data.valid === false ? 'dpicker-invalid' : ''}">`
}

/**
 * Dpicker container if no input is provided
 * if an input is given, it's parentNode will be the container
 *
 * ```
 * div.dpicker
 * ```
 * @method
 * @return {H} the rendered virtual dom hierarchy
 */
DPicker.prototype.renderContainer = function (events, data, toRender) {
  return html`<div class="dpicker">${toRender}</div>`
}

/**
 * Render a DPicker
 *
 * ```
 * div.dpicker#[uuid]
 *   input[type=text]
 *   div.dpicker-container.dpicker-[visible|invisible]
 * ```
 * @method
 * @see DPicker#renderYears
 * @see DPicker#renderMonths
 * @see DPicker#renderDays
 * @return {H} the rendered virtual dom hierarchy
 */
DPicker.prototype.render = function (events, data, toRender) {
  return html`<div
    aria-hidden="${data.display === false}"
    class="dpicker-container ${data.display === true ? 'dpicker-visible' : 'dpicker-invisible'}">
    ${toRender}
    </div>`
}

/**
 * Render Years
 * ```
 * select[name='dpicker-year']
 * ```
 * @method
 * @listens DPicker#yearChange
 * @return {H} the rendered virtual dom hierarchy
 */
DPicker.prototype.renderYears = function (events, data, toRender) {
  let modelYear = DPicker._dateAdapter.getYear(data.model)
  let futureYear = DPicker._dateAdapter.getYear(data.max) + 1
  let pastYear = DPicker._dateAdapter.getYear(data.min)
  let options = []

  while (--futureYear >= pastYear) {
    options.push(this._setSelected(html`<option value="${futureYear}">${futureYear}</option>`, futureYear === modelYear))
  }

  return html`<select onchange="${events.yearChange}" name="dpicker-year" aria-label="Year">${options}</select>`
}

/**
 * Render Months
 * ```
 * select[name='dpicker-month']
 * ```
 * @method
 * @listens DPicker#monthChange
 * @return {H} the rendered virtual dom hierarchy
 */
DPicker.prototype.renderMonths = function (events, data, toRender) {
  let modelMonth = DPicker._dateAdapter.getMonth(data.model)
  let currentYear = DPicker._dateAdapter.getYear(data.model)
  let months = data.months
  let showMonths = data.months.map((e, i) => i)

  if (DPicker._dateAdapter.getYear(data.max) === currentYear) {
    let maxMonth = DPicker._dateAdapter.getMonth(data.max)
    showMonths = showMonths.filter(e => e <= maxMonth)
  }

  if (DPicker._dateAdapter.getYear(data.min) === currentYear) {
    let minMonth = DPicker._dateAdapter.getMonth(data.min)
    showMonths = showMonths.filter(e => e >= minMonth)
  }

  return html`<select onchange="${events.monthChange}" name="dpicker-month" aria-label="Month">
      ${showMonths.map((e, i) => this._setSelected(html`<option value="${e}">${months[e]}</option>`, e === modelMonth))}
    </select>`
}

/**
 * Render Days
 * ```
 * table
 *  tr
 *    td
 *      button|span
 * ```
 * @method
 * @listens DPicker#dayClick
 * @listens DPicker#dayKeyDown
 * @return {H} the rendered virtual dom hierarchy
 */
DPicker.prototype.renderDays = function (events, data, toRender) {
  let daysInMonth = DPicker._dateAdapter.daysInMonth(data.model)
  let daysInPreviousMonth = DPicker._dateAdapter.daysInMonth(DPicker._dateAdapter.subMonths(data.model, 1))
  let firstLocaleDay = data.firstDayOfWeek
  let firstDay = DPicker._dateAdapter.firstWeekDay(data.model) - 1
  let currentDay = DPicker._dateAdapter.getDate(data.model)
  let currentMonth = DPicker._dateAdapter.getMonth(data.model)
  let currentYear = DPicker._dateAdapter.getYear(data.model)

  let days = new Array(7)

  data.days.map((e, i) => {
    days[i < firstLocaleDay ? 6 - i : i - firstLocaleDay] = e
  })

  let rows = new Array(Math.ceil(0.1 + (firstDay + daysInMonth) / 7)).fill(0)
  let day
  let dayActive
  let previousMonth = false
  let nextMonth = false
  let loopend = true
  let classActive = ''

  return html`<table>
    <tr>${days.map(e => html`<th>${e}</th>`)}</tr>
    ${rows.map((e, row) => {
      return html`<tr>${new Array(7).fill(0).map((e, col) => {
        dayActive = loopend
        classActive = ''

        if (col <= firstDay && row === 0) {
          day = daysInPreviousMonth - (firstDay - col)
          dayActive = false
          previousMonth = true
        } else if (col === firstDay + 1 && row === 0) {
          previousMonth = false
          day = 1
          dayActive = true
        } else {
          if (day === daysInMonth) {
            day = 0
            dayActive = false
            loopend = false
            nextMonth = true
          }

          day++
        }

        let dayMonth = previousMonth ? currentMonth : (nextMonth ? currentMonth + 2 : currentMonth + 1)
        let currentDayModel = new Date(currentYear, dayMonth - 1, day)

        if (dayActive === false && data.siblingMonthDayClick === true) {
          dayActive = true
        }

        if (data.min && dayActive) {
          dayActive = DPicker._dateAdapter.isSameOrAfter(currentDayModel, data.min)
        }

        if (data.max && dayActive) {
          dayActive = DPicker._dateAdapter.isSameOrBefore(currentDayModel, data.max)
        }

        if (dayActive === true && previousMonth === false && nextMonth === false && currentDay === day) {
          classActive = 'dpicker-active'
        }

        return html`<td class="${dayActive === true ? 'dpicker-active' : 'dpicker-inactive'}">
          ${
            dayActive === true
              ? html`<button value="${day}" aria-label="Day ${day}" aria-disabled="${dayActive}" onclick="${previousMonth === false && nextMonth === false ? events.dayClick : (previousMonth === true ? events.previousMonthDayClick : events.nextMonthDayClick)}" type="button" onkeydown="${events.dayKeyDown}" class="${classActive}">
                ${day}
              </button>`
            : html`<span class="${classActive}">${day}</span>`
          }
          </td>`
      })}</tr>`
    })}
  </table>`
}

/**
 * Called after parseInputAttributes but before render
 * Use it with modules to change things on initialization
 */
DPicker.prototype.initialize = function () {
  this.isValid(this._data.model)
}

/**
 * The model setter, feel free to override through modules
 * @param {Moment} newValue
 */
DPicker.prototype.modelSetter = function (newValue) {
  this._data.empty = !newValue

  if (this.isValid(newValue) === true) {
    this._data.model = newValue
  }

  this.redraw()
}

DPicker.prototype.redraw = function () {
  const newTree = this.getTree()
  this._tree = nanomorph(this._tree, newTree)
}

Object.defineProperties(DPicker.prototype, {
  /**
   * @var {String} DPicker#container
   * @description Get container id
   */
  'container': {
    get: function () {
      return this._container
    }
  },
  /**
   * @var {String} DPicker#inputId
   * @description Get input id
   */
  'inputId': {
    get: function () {
      return this._data.inputId
    }
  },
  /**
   * @var {String} DPicker#input
   * @description Get current input value (not the model)
   */
  'input': {
    get: function () {
      if (this._data.empty) {
        return ''
      }

      return DPicker._dateAdapter.format(this._data.model, this._data.format)
    }
  },
  /**
   * @var {Function} DPicker#onChange
   * @description Set onChange method
   */
  'onChange': {
    set: function (onChange) {
      this._onChange = (dpickerEvent) => {
        return !onChange ? false : onChange(this._data, dpickerEvent)
      }
    },
    get: function () {
      return this._onChange
    }
  },

  /**
   * @var {Boolean} DPicker#valid
   * @description Is the current input valid
   */
  'valid': {
    get: function () {
      return this._data.valid
    }
  },

  /**
   * @var {Moment} DPicker#model
   * @description Get/Set model, a Moment instance
   */
  'model': {
    set: function (newValue) {
      this.modelSetter(newValue)
    },
    get: function () {
      return this._data.model
    }
  }
})

/**
 * Creates a decorator
 * @internal
 * @param {String} which    one of events, calls
 * @param {Function} origin the origin function that will be decorated
 * @param {String} key      the key of the "which" we need to decorate
 */
DPicker.decorate = function (origin, decoration) {
  return function decorator () {
    if (decoration.apply(this, arguments) === false) {
      return false
    }

    return origin.apply(this, arguments)
  }
}

DPicker._events = {
  /**
    * Hides the date picker if user does not click inside the container
    * @event DPicker#hide
    * @param {Event} DOMEvent
    */
  hide: function hide (evt) {
    if (this._data.hideOnOutsideClick === false || this.display === false) {
      return
    }

    let node = evt.target

    if (isElementInContainer(node.parentNode, this._container)) {
      return
    }

    this.display = false
    this.onChange({modelChanged: false, name: 'hide', event: evt})
  },

  /**
    * Change model on input change
    * @event DPicker#inputChange
    * @param {Event} DOMEvent
    */
  inputChange: function inputChange (evt) {
    if (!evt.target.value) {
      this._data.empty = true
    } else {
      let newModel = DPicker._dateAdapter.isValidWithFormat(evt.target.value, this._data.format)

      if (newModel !== false) {
        if (this.isValid(newModel) === true) {
          this._data.model = newModel
        }
      }

      this._data.empty = false
    }

    this.redraw()
    this.onChange({modelChanged: true, name: 'inputChange', event: evt})
  },

  /**
    * Hide on input blur
    * @event DPicker#inputBlur
    * @param {Event} DOMEvent
    */
  inputBlur: function inputBlur (evt) {
    if (this.display === false) {
      return
    }

    let node = evt.relatedTarget || evt.target

    if (isElementInContainer(node.parentNode, this._container)) {
      return
    }

    this.display = false
    this.onChange({modelChanged: false, name: 'inputBlur', event: evt})
  },

  /**
    * Show the container on input focus
    * @event DPicker#inputFocus
    * @param {Event} DOMEvent
    */
  inputFocus: function inputFocus (evt) {
    this.display = true
    if (evt.target && evt.target.select) {
      evt.target.select()
    }

    this.onChange({modelChanged: false, name: 'inputFocus', event: evt})
  },

  /**
    * On year change, update the model value
    * @event DPicker#yearChange
    * @param {Event} DOMEvent
    */
  yearChange: function yearChange (evt) {
    this._data.empty = false
    this.model = DPicker._dateAdapter.setYear(this._data.model, evt.target.options[evt.target.selectedIndex].value)

    this.redraw()
    this.onChange({modelChanged: true, name: 'yearChange', event: evt})
  },

  /**
    * On month change, update the model value
    * @event DPicker#monthChange
    * @param {Event} DOMEvent
    */
  monthChange: function monthChange (evt) {
    this._data.empty = false
    this.model = DPicker._dateAdapter.setMonth(this._data.model, evt.target.options[evt.target.selectedIndex].value)

    this.redraw()
    this.onChange({modelChanged: true, name: 'monthChange', event: evt})
  },

  /**
    * On day click, update the model value
    * @Event DPicker#dayClick
    * @param {Event} DOMEvent
    */
  dayClick: function dayClick (evt) {
    evt.preventDefault()
    evt.stopPropagation()
    this.model = DPicker._dateAdapter.setDate(this._data.model, evt.target.value)
    this._data.empty = false

    if (this._data.hideOnDayClick) {
      this.display = false
    }

    this.redraw()
    this.onChange({modelChanged: true, name: 'dayClick', event: evt})
  },

  previousMonthDayClick: function previousMonthDayClick (evt) {
    if (!this._data.siblingMonthDayClick) {
      return
    }

    evt.preventDefault()
    evt.stopPropagation()

    this.model = DPicker._dateAdapter.subMonths(DPicker._dateAdapter.setDate(this._data.model, evt.target.value), 1)

    this._data.empty = false

    if (this._data.hideOnDayClick) {
      this.display = false
    }

    this.redraw()
    this.onChange({modelChanged: true, name: 'previousMonthDayClick', event: evt})
  },

  nextMonthDayClick: function nextMonthDayClick (evt) {
    if (!this._data.siblingMonthDayClick) {
      return
    }

    evt.preventDefault()
    evt.stopPropagation()

    this.model = DPicker._dateAdapter.addMonths(DPicker._dateAdapter.setDate(this._data.model, evt.target.value), 1)

    this._data.empty = false

    if (this._data.hideOnDayClick) {
      this.display = false
    }

    this.redraw()
    this.onChange({modelChanged: true, name: 'nextMonthDayClick', event: evt})
  },

  /**
    * On day key down - not implemented
    * @Event DPicker#dayKeyDown
    * @param {Event} DOMEvent
    */
  dayKeyDown: function dayKeyDown () {
  },

  /**
    * On key down inside the dpicker container,
    * intercept enter and escape keys to hide the container
    * @Event DPicker#keyDown
    * @param {Event} DOMEvent
    */
  keyDown: function keyDown (evt) {
    if (!this._data.hideOnEnter) {
      return
    }

    let key = evt.which || evt.keyCode

    if (key !== 13 && key !== 27) {
      return
    }

    document.getElementById(this.inputId).blur()
    this.display = false
    this.onChange({modelChanged: false, name: 'keyDown', event: evt})
  }
}

DPicker._renders = {}

DPicker._properties = {display: false}

DPicker._dateAdapter = MomentDateAdapter

/**
 * @var {String} DPicker#format
 * @description Get/Set format, a Moment format string
 */
/**
 * @var {Boolean} DPicker#display
 * @description Get/Set display, hides or shows the date picker
 */
/**
 * @var {Moment} DPicker#min
 * @description Get/Set min date
 */
/**
 * @var {Moment} DPicker#max
 * @description Get/Set max date
 */
/**
 * @var {Array.<string>} DPicker#months
 * @description Get/Set months an array of strings representing months, defaults to moment.months()
 */
/**
 * @var {Array.<string>} DPicker#days
 * @description Get/Set days an array of strings representing days, defaults to moment.weekdaysShort()
 */

module.exports = DPicker
