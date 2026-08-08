'use client'

import { useState, useEffect, useMemo } from 'react'
import { getCountryDataList, getEmojiFlag } from 'countries-list'

// Priority country ISO codes to show at top of select list
const PRIORITY_ISO = ['IN', 'NP', 'US', 'GB', 'AE', 'CA', 'AU', 'SG']

export default function CountryPhoneInput({
  value = '',
  onChange,
  placeholder = 'Enter phone number',
  className = '',
  disabled = false,
}) {
  // Generate curated country list sorted with priority countries on top
  const countries = useMemo(() => {
    const rawList = getCountryDataList()
    const countryMap = new Map()

    rawList.forEach((c) => {
      if (c.phone && c.phone.length > 0) {
        const primaryPhone = `+${c.phone[0]}`
        const flag = getEmojiFlag(c.iso2)
        const key = `${c.iso2}-${primaryPhone}`
        if (!countryMap.has(key)) {
          countryMap.set(key, {
            iso2: c.iso2,
            name: c.name,
            dialCode: primaryPhone,
            flag,
            displayLabel: `${flag} ${primaryPhone} (${c.name})`,
          })
        }
      }
    })

    const list = Array.from(countryMap.values())

    // Separate priority vs others
    const priorityList = []
    const otherList = []

    PRIORITY_ISO.forEach((iso) => {
      const found = list.find((item) => item.iso2 === iso)
      if (found) priorityList.push(found)
    })

    list.forEach((item) => {
      if (!PRIORITY_ISO.includes(item.iso2)) {
        otherList.push(item)
      }
    })

    otherList.sort((a, b) => a.name.localeCompare(b.name))

    return { priorityList, otherList }
  }, [])

  // Parse incoming value like "+91 9876543210" or "+977981234567"
  const parsed = useMemo(() => {
    const cleaned = (value || '').trim()
    if (!cleaned) return { dialCode: '+91', number: '' }

    const all = [...countries.priorityList, ...countries.otherList].sort(
      (a, b) => b.dialCode.length - a.dialCode.length
    )

    const match = all.find((c) => cleaned.startsWith(c.dialCode))
    if (match) {
      const numberPart = cleaned.slice(match.dialCode.length).trim()
      return { dialCode: match.dialCode, number: numberPart }
    }

    return { dialCode: '+91', number: cleaned }
  }, [value, countries])

  const [selectedDialCode, setSelectedDialCode] = useState(parsed.dialCode)
  const [phoneNumber, setPhoneNumber] = useState(parsed.number)

  // Keep internal state updated when external prop changes
  useEffect(() => {
    setSelectedDialCode(parsed.dialCode)
    setPhoneNumber(parsed.number)
  }, [parsed.dialCode, parsed.number])

  const selectedCountry = useMemo(() => {
    const all = [...countries.priorityList, ...countries.otherList]
    return all.find((c) => c.dialCode === selectedDialCode) || countries.priorityList[0]
  }, [selectedDialCode, countries])

  const handleDialCodeChange = (e) => {
    const newDial = e.target.value
    setSelectedDialCode(newDial)
    const combined = phoneNumber ? `${newDial} ${phoneNumber}` : newDial
    onChange?.(combined)
  }

  const handleNumberChange = (e) => {
    const newNum = e.target.value.replace(/[^\d\s-]/g, '')
    setPhoneNumber(newNum)
    const combined = newNum ? `${selectedDialCode} ${newNum}` : ''
    onChange?.(combined)
  }

  return (
    <div className={`flex items-center rounded-xl border border-black/10 bg-white overflow-hidden focus-within:border-brand focus-within:ring-1 focus-within:ring-brand transition-all ${className}`}>
      {/* Country Code Trigger + Invisible Select */}
      <div className="relative border-r border-black/10 bg-slate-50/90 shrink-0 flex items-center px-3 py-2.5 gap-1.5 cursor-pointer hover:bg-slate-100 transition-colors">
        <span className="text-[15px] leading-none select-none">{selectedCountry?.flag || '🌐'}</span>
        <span className="text-[13px] font-semibold text-slate-800 leading-none">{selectedDialCode}</span>
        <span className="text-[9px] text-slate-400 leading-none">▼</span>

        {/* Overlay native select */}
        <select
          value={selectedDialCode}
          onChange={handleDialCodeChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          aria-label="Select Country Code"
        >
          <optgroup label="Popular Countries">
            {countries.priorityList.map((c) => (
              <option key={`p-${c.iso2}-${c.dialCode}`} value={c.dialCode}>
                {c.flag} {c.dialCode} ({c.name})
              </option>
            ))}
          </optgroup>
          <optgroup label="All Countries">
            {countries.otherList.map((c) => (
              <option key={`o-${c.iso2}-${c.dialCode}`} value={c.dialCode}>
                {c.flag} {c.dialCode} ({c.name})
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Phone Number Digits Input */}
      <input
        type="tel"
        value={phoneNumber}
        onChange={handleNumberChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 min-w-0 px-3.5 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent disabled:cursor-not-allowed"
      />
    </div>
  )
}
