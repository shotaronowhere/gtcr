import React from 'react'
import PropTypes from 'prop-types'
import { Icon, Tooltip } from 'antd'
import DisplaySelector from './display-selector'
import styled from 'styled-components/macro'
import itemTypes from '../utils/item-types'

const StyledField = styled.div`
  margin-bottom: 16px;
  margin-right: 16px;
  word-break: break-word;
`

const TCRMetadataDisplay = ({ logoURI, tcrTitle, tcrDescription, fileURI }) => (
  <>
    <StyledField>
      <span>
        Logo:
        <Tooltip title="The TCR logo.">
          &nbsp;
          <Icon type="question-circle-o" />
        </Tooltip>
      </span>
      : <DisplaySelector type={itemTypes.IMAGE} linkImage value={logoURI} />
    </StyledField>
    <StyledField>
      <span>
        Title
        <Tooltip title="The TCR title.">
          &nbsp;
          <Icon type="question-circle-o" />
        </Tooltip>
      </span>
      : <DisplaySelector type={itemTypes.TEXT} value={tcrTitle} />
    </StyledField>
    <StyledField>
      <span>
        Description
        <Tooltip title="The TCR description.">
          &nbsp;
          <Icon type="question-circle-o" />
        </Tooltip>
      </span>
      : <DisplaySelector type={itemTypes.TEXT} value={tcrDescription} />
    </StyledField>
    <StyledField>
      <span>
        Primary document
        <Tooltip title="The primary document used by this TCR.">
          &nbsp;
          <Icon type="question-circle-o" />
        </Tooltip>
      </span>
      :{' '}
      <a
        target="_blank"
        rel="noopener noreferrer"
        href={`${process.env.REACT_APP_IPFS_GATEWAY}${fileURI}`}
      >
        Link
      </a>
    </StyledField>
  </>
)

TCRMetadataDisplay.propTypes = {
  tcrTitle: PropTypes.string.isRequired,
  tcrDescription: PropTypes.string.isRequired,
  logoURI: PropTypes.string.isRequired,
  fileURI: PropTypes.string.isRequired
}

export default TCRMetadataDisplay