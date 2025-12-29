import { describe, it, expect } from 'vitest'
import {
  toSdkMcpServers,
  toAgentMessageType,
  toResultSubtype,
  toAgentMessage,
} from '../src/converters'
import { AgentMessageType, ResultSubtype } from '@autonoe/core'

describe('converters', () => {
  describe('toSdkMcpServers', () => {
    it('SC-AC001: returns empty record for empty input', () => {
      const result = toSdkMcpServers({})
      expect(result).toEqual({})
    })

    it('SC-AC002: converts server with args to SDK format', () => {
      const input = {
        playwright: { command: 'npx', args: ['playwright-mcp'] },
      }
      const result = toSdkMcpServers(input)
      expect(result).toEqual({
        playwright: { command: 'npx', args: ['playwright-mcp'] },
      })
    })

    it('converts multiple servers', () => {
      const input = {
        server1: { command: 'cmd1' },
        server2: { command: 'cmd2', args: ['arg'] },
      }
      const result = toSdkMcpServers(input)
      expect(Object.keys(result)).toHaveLength(2)
      expect(result).toMatchObject({
        server1: { command: 'cmd1' },
        server2: { command: 'cmd2', args: ['arg'] },
      })
    })

    it('handles server without args', () => {
      const input = { simple: { command: 'simple-cmd' } }
      const result = toSdkMcpServers(input)
      expect(result).toEqual({
        simple: { command: 'simple-cmd', args: undefined },
      })
    })
  })

  describe('toAgentMessageType', () => {
    it('SC-AC003: converts "text" to AgentMessageType.Text', () => {
      expect(toAgentMessageType('text')).toBe(AgentMessageType.Text)
    })

    it('SC-AC004: converts "result" to AgentMessageType.Result', () => {
      expect(toAgentMessageType('result')).toBe(AgentMessageType.Result)
    })

    it('SC-AC005: defaults unknown types to AgentMessageType.Text', () => {
      expect(toAgentMessageType('unknown')).toBe(AgentMessageType.Text)
      expect(toAgentMessageType('')).toBe(AgentMessageType.Text)
    })
  })

  describe('toResultSubtype', () => {
    it('SC-AC006: converts "success" to ResultSubtype.Success', () => {
      expect(toResultSubtype('success')).toBe(ResultSubtype.Success)
    })

    it('SC-AC007: converts "error_max_turns"', () => {
      expect(toResultSubtype('error_max_turns')).toBe(
        ResultSubtype.ErrorMaxTurns,
      )
    })

    it('SC-AC008: converts "error_during_execution"', () => {
      expect(toResultSubtype('error_during_execution')).toBe(
        ResultSubtype.ErrorDuringExecution,
      )
    })

    it('SC-AC009: converts "error_max_budget_usd"', () => {
      expect(toResultSubtype('error_max_budget_usd')).toBe(
        ResultSubtype.ErrorMaxBudgetUsd,
      )
    })

    it('SC-AC010: defaults unknown subtypes to ErrorDuringExecution', () => {
      expect(toResultSubtype('unknown')).toBe(
        ResultSubtype.ErrorDuringExecution,
      )
      expect(toResultSubtype('')).toBe(ResultSubtype.ErrorDuringExecution)
    })
  })

  describe('toAgentMessage', () => {
    it('SC-AC011: converts text message', () => {
      const sdkMessage = { type: 'text', content: 'Hello' }
      const result = toAgentMessage(sdkMessage)
      expect(result.type).toBe(AgentMessageType.Text)
      expect(result).toHaveProperty('content', 'Hello')
    })

    it('SC-AC012: converts snake_case to camelCase for cost', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0.05,
      }
      const result = toAgentMessage(sdkMessage)
      expect(result).toHaveProperty('totalCostUsd', 0.05)
      expect(result).not.toHaveProperty('total_cost_usd')
    })

    it('converts result message with success', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'success',
        result: 'Done',
      }
      const result = toAgentMessage(sdkMessage)
      expect(result.type).toBe(AgentMessageType.Result)
      expect(result).toHaveProperty('subtype', ResultSubtype.Success)
      expect(result).toHaveProperty('result', 'Done')
    })

    it('converts result message with errors', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'error_during_execution',
        errors: ['Error 1', 'Error 2'],
      }
      const result = toAgentMessage(sdkMessage)
      expect(result).toHaveProperty('errors', ['Error 1', 'Error 2'])
    })

    it('handles missing optional fields', () => {
      const sdkMessage = { type: 'result', subtype: 'success' }
      const result = toAgentMessage(sdkMessage)
      expect(result).toHaveProperty('result', undefined)
      expect(result).toHaveProperty('errors', undefined)
      expect(result).toHaveProperty('totalCostUsd', undefined)
    })

    it('preserves extra SDK fields for text messages', () => {
      const sdkMessage = { type: 'text', custom_field: 'value' }
      const result = toAgentMessage(sdkMessage)
      expect(result).toHaveProperty('custom_field', 'value')
    })
  })
})
